import { Address, log, Bytes, ethereum } from '@graphprotocol/graph-ts'

import {
  CollateralType,
  Safe,
  UserProxy,
  InternalCollateralBalance,
  InternalBondBalance,
  InternalDebtBalance,
} from '../../../../generated/schema'

import { getSystemState } from '../../../entities'

import {
  InitializeCollateralType,
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersCollateralTypeUint,
  ModifyCollateralBalance,
  TransferCollateral,
  TransferInternalCoins,
  ModifySAFECollateralization,
  TransferSAFECollateralAndDebt,
  ConfiscateSAFECollateralAndDebt,
  SettleDebt,
  CreateUnbackedDebt,
  UpdateAccumulatedRate,
} from '../../../../generated/SAFEEngine/SAFEEngine'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { getOrCreateCollateral, updateLastModifyCollateralType } from '../../../entities/collateral'
import {
  createBondBalance,
  createCollateralBalance,
  updateBondBalance,
  updateCollateralBalance,
  createDebtBalance,
  updateDebtBalance,
  getOrCreateBondBalance,
  getOrCreateDebtBalance,
  getOrCreateCollateralBalance,
} from '../../../entities/balances'
import { createUnmanagedSafe, updateSafeCollateralization } from '../../../entities/safe'
import { updateLastModifySystemState } from '../../../entities/system'

// Register a new collateral type
export function handleInitializeCollateralType(event: InitializeCollateralType): void {
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  log.info('Onboard new collateral {}', [collateral.id])

  // Update system state
  let system = getSystemState(event)
  system.collateralCount = system.collateralCount.plus(integer.ONE)
  updateLastModifySystemState(system, event)
  system.save()
}

// Modify collateral type parameters
export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let system = getSystemState(event)
  let what = event.params.parameter.toString()
  let data = event.params.data

  if (what == 'globalDebtCeiling') {
    system.globalDebtCeiling = decimal.fromRad(data)
    updateLastModifySystemState(system, event)
    system.save()
  }
}

export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {
  let collateralType = event.params.collateralType.toString()
  let what = event.params.parameter.toString()
  let data = event.params.data

  let collateral = CollateralType.load(collateralType)

  if (collateral != null) {
    if (what == 'safetyPrice') {
      // Safety  price is stored on the current price object
    } else if (what == 'debtCeiling') {
      collateral.debtCeiling = decimal.fromRad(data)
    } else if (what == 'debtFloor') {
      collateral.debtFloor = decimal.fromRad(data)
    } else if (what == 'liquidationPrice') {
      // Liquidation price is stored on the current price object
    } else {
      return
    }
    updateLastModifyCollateralType(collateral as CollateralType, event)
    collateral.save()
  }
}
// Modify a user's collateral balance
export function handleModifyCollateralBalance(event: ModifyCollateralBalance): void {
  let account = event.params.account
  let collateral = event.params.collateralType

  let balance = getOrCreateCollateralBalance(account, collateral, event)
  updateCollateralBalance(balance, balance.balance.plus(decimal.fromWad(event.params.wad)), event)
  balance.save()
}

// Transfer collateral between users
export function handleTransferCollateral(event: TransferCollateral): void {
  let collateral = event.params.collateralType
  let src = getOrCreateCollateralBalance(event.params.src, collateral, event, false)
  let dst = getOrCreateCollateralBalance(event.params.dst, collateral, event)
  updateCollateralBalance(src, src.balance.minus(decimal.fromWad(event.params.wad)), event)
  updateCollateralBalance(dst, dst.balance.plus(decimal.fromWad(event.params.wad)), event)
  src.save()
  dst.save()
}

// Transfer reflexer bond between users
export function handleTransferInternalCoins(event: TransferInternalCoins): void {
  let src = getOrCreateBondBalance(event.params.src, event, false)
  let dst = getOrCreateBondBalance(event.params.dst, event)
  updateBondBalance(src, src.balance.minus(decimal.fromRad(event.params.rad)), event)
  updateBondBalance(dst, dst.balance.plus(decimal.fromRad(event.params.rad)), event)
  src.save()
  dst.save()
}

// Create or modify a SAFE
export function handleModifySAFECollateralization(event: ModifySAFECollateralization): void {
  let collateralType = event.params.collateralType.toString()
  let safeAddress = event.params.safe
  let deltaCollateral = event.params.deltaCollateral
  let deltaDebt = event.params.deltaDebt

  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  if (collateral != null) {
    let debt = decimal.fromWad(deltaDebt)
    let collateralBalance = decimal.fromWad(deltaCollateral)
    let safeId = safeAddress.toHexString() + '-' + collateralType
    let safe = Safe.load(safeId)
    let system = getSystemState(event)

    if (safe == null) {
      log.info('New unmanaged: {}', [safe.id])
      // Register new unmanaged safe
      safe = createUnmanagedSafe(safeAddress, event.params.collateralType, event)
      updateSafeCollateralization(safe as Safe, collateralBalance, debt, event)
    } else {
      // Update existing Vault
      log.info('Update cpd collateralization of: ', [safe.id])
      updateSafeCollateralization(safe as Safe, safe.collateral.plus(collateralBalance), safe.debt.plus(debt), event)
    }
    safe.save()

    // Update debt counter
    collateral.debtAmount = collateral.debtAmount.plus(debt)
    updateLastModifyCollateralType(collateral as CollateralType, event)
    collateral.save()

    system.globalDebt = system.globalDebt.plus(debt)
    updateLastModifySystemState(system, event)
    system.save()

    // Update balances
    let internalCollateralBalance = getOrCreateCollateralBalance(
      event.params.collateralSource,
      event.params.collateralType,
      event,
      false,
    )
    updateCollateralBalance(
      internalCollateralBalance,
      internalCollateralBalance.balance.minus(decimal.fromWad(deltaCollateral)),
      event,
    )
    internalCollateralBalance.save()

    let internalBondBalance = getOrCreateBondBalance(event.params.debtDestination, event)
    updateBondBalance(internalBondBalance, internalBondBalance.balance.plus(decimal.fromWad(deltaDebt)), event)
    internalBondBalance.save()
  }
}

// Split a SAFE - binary approval or splitting/merging Vaults
export function handleTransferSAFECollateralAndDebt(event: TransferSAFECollateralAndDebt): void {
  // Both should be non dusty so they exist
  let srcSafe = Safe.load(event.params.src.toHexString() + '-' + event.params.collateralType.toString()) as Safe
  let dstSafe = Safe.load(event.params.src.toHexString() + '-' + event.params.collateralType.toString()) as Safe

  updateSafeCollateralization(
    srcSafe,
    srcSafe.collateral.minus(decimal.fromWad(event.params.deltaCollateral)),
    srcSafe.debt.minus(decimal.fromWad(event.params.deltaDebt)),
    event,
  )

  updateSafeCollateralization(
    dstSafe,
    dstSafe.collateral.plus(decimal.fromWad(event.params.deltaCollateral)),
    dstSafe.debt.plus(decimal.fromWad(event.params.deltaDebt)),
    event,
  )

  srcSafe.save()
  dstSafe.save()
}

// Liquidate a SAFE
export function handleConfiscateSAFECollateralAndDebt(event: ConfiscateSAFECollateralAndDebt): void {
  let collateralType = event.params.collateralType
  let deltaDebt = decimal.fromWad(event.params.deltaCollateral)
  let deltaCollateral = decimal.fromWad(event.params.deltaCollateral)

  let safe = Safe.load(event.params.safe.toHexString() + '-' + collateralType.toString())
  safe.collateral = safe.collateral.plus(deltaCollateral)
  safe.debt = safe.debt.plus(deltaDebt)
  safe.save()

  // Update collateral debt counter
  let collateral = getOrCreateCollateral(collateralType, event)
  collateral.debtAmount = collateral.debtAmount.plus(deltaDebt)
  collateral.save()

  // Update counter party collateral
  let collateraCounterPartyBalance = getOrCreateCollateralBalance(
    event.params.collateralCounterparty,
    collateralType,
    event,
  )

  updateCollateralBalance(
    collateraCounterPartyBalance,
    collateraCounterPartyBalance.balance.minus(deltaCollateral),
    event,
  )
  collateraCounterPartyBalance.save()

  // Update counter party debt
  let deltaTotalIssuedDebt = deltaDebt.times(collateral.accumulatedRate)
  let debtCounterPartyBalance = getOrCreateDebtBalance(event.params.debtCounterparty, event)
  updateDebtBalance(debtCounterPartyBalance, debtCounterPartyBalance.balance.minus(deltaTotalIssuedDebt), event)
  debtCounterPartyBalance.save()

  // Update global debt counter
  let system = getSystemState(event)
  system.globalUnbackedDebt = system.globalUnbackedDebt.minus(deltaTotalIssuedDebt)
  system.save()
}

// Create/destroy equal quantities of reflexer bond and system debt
export function handleSettleDebt(event: SettleDebt): void {
  let rad = decimal.fromRad(event.params.rad)

  // Update debt counters
  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.minus(rad)
  system.globalUnbackedDebt = system.globalUnbackedDebt.minus(rad)
  updateLastModifySystemState(system, event)
  system.save()

  // Update debt and bond balance
  let account = event.address // msg.sender
  let balance = getOrCreateBondBalance(account, event)
  let debt = getOrCreateDebtBalance(account, event)
  updateBondBalance(balance, balance.balance.minus(rad), event)
  updateDebtBalance(debt, debt.balance.minus(rad), event)
  balance.save()
  debt.save()
}

// Mint unbacked reflexer bonds
export function handleCreateUnbackedDebt(event: CreateUnbackedDebt): void {
  let rad = decimal.fromRad(event.params.rad)

  // Update debt counters
  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.plus(rad)
  system.globalUnbackedDebt = system.globalUnbackedDebt.plus(rad)
  updateLastModifySystemState(system, event)
  system.save()

  // Credit the bonds
  let balance = getOrCreateBondBalance(event.params.coinDestination, event)
  updateBondBalance(balance, balance.balance.plus(rad), event)
  balance.save()

  // Add the debt
  let debt = getOrCreateDebtBalance(event.params.debtDestination, event)
  updateDebtBalance(debt, debt.balance.plus(rad), event)
  debt.save()
}

// Modify the debt multiplier, creating/destroying corresponding debt
export function handleUpdateAccumulatedRate(event: UpdateAccumulatedRate): void {
  let rate = decimal.fromRay(event.params.rateMultiplier)
  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  let rad = collateral.debtAmount.times(rate)

  // Set the new rate
  collateral.accumulatedRate = collateral.accumulatedRate.plus(rate)
  updateLastModifyCollateralType(collateral as CollateralType, event)
  collateral.save()

  // Update debt counter
  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.plus(rad)
  updateLastModifySystemState(system, event)
  system.save()

  // Send the taxes
  let dst = getOrCreateBondBalance(event.params.surplusDst, event)
  updateBondBalance(dst, dst.balance.plus(decimal.fromRad(event.params.dstCoinBalance)), event)
  dst.save()
}
