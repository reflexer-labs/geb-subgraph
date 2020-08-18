import { Address, log, Bytes, ethereum } from '@graphprotocol/graph-ts'

import {
  CollateralType,
  Cdp,
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
  ModifyCDPCollateralization,
  TransferCDPCollateralAndDebt,
  ConfiscateCDPCollateralAndDebt,
  SettleDebt,
  CreateUnbackedDebt,
  UpdateAccumulatedRate,
} from '../../../../generated/CDPEngine/CDPEngine'

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
import { createUnmanagedCdp, updateCdpCollateralization } from '../../../entities/cdp'
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

// Create or modify a CDP
export function handleModifyCDPCollateralization(event: ModifyCDPCollateralization): void {
  let collateralType = event.params.collateralType.toString()
  let cdpAddress = event.params.cdp
  let deltaCollateral = event.params.deltaCollateral
  let deltaDebt = event.params.deltaDebt

  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  if (collateral != null) {
    let debt = decimal.fromWad(deltaDebt)
    let collateralBalance = decimal.fromWad(deltaCollateral)
    let cdpId = cdpAddress.toHexString() + '-' + collateralType
    let cdp = Cdp.load(cdpId)
    let system = getSystemState(event)

    if (cdp == null) {
      log.info('New unmanaged: {}', [cdp.id])
      // Register new unmanaged cdp
      cdp = createUnmanagedCdp(cdpAddress, event.params.collateralType, event)
      updateCdpCollateralization(cdp as Cdp, collateralBalance, debt, event)
    } else {
      // Update existing Vault
      log.info('Update cpd collateralization of: ', [cdp.id])
      updateCdpCollateralization(cdp as Cdp, cdp.collateral.plus(collateralBalance), cdp.debt.plus(debt), event)
    }
    cdp.save()

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

// Split a CDP - binary approval or splitting/merging Vaults
export function handleTransferCDPCollateralAndDebt(event: TransferCDPCollateralAndDebt): void {
  // Both should be non dusty so they exist
  let srcCdp = Cdp.load(event.params.src.toHexString() + '-' + event.params.collateralType.toString()) as Cdp
  let dstCdp = Cdp.load(event.params.src.toHexString() + '-' + event.params.collateralType.toString()) as Cdp

  updateCdpCollateralization(
    srcCdp,
    srcCdp.collateral.minus(decimal.fromWad(event.params.deltaCollateral)),
    srcCdp.debt.minus(decimal.fromWad(event.params.deltaDebt)),
    event,
  )

  updateCdpCollateralization(
    dstCdp,
    dstCdp.collateral.plus(decimal.fromWad(event.params.deltaCollateral)),
    dstCdp.debt.plus(decimal.fromWad(event.params.deltaDebt)),
    event,
  )

  srcCdp.save()
  dstCdp.save()
}

// Liquidate a CDP
export function handleConfiscateCDPCollateralAndDebt(event: ConfiscateCDPCollateralAndDebt): void {
  let collateralType = event.params.collateralType
  let deltaDebt = decimal.fromWad(event.params.deltaCollateral)
  let deltaCollateral = decimal.fromWad(event.params.deltaCollateral)

  let cdp = Cdp.load(event.params.cdp.toHexString() + '-' + collateralType.toString())
  cdp.collateral = cdp.collateral.plus(deltaCollateral)
  cdp.debt = cdp.debt.plus(deltaDebt)
  cdp.save()

  let collateral = getOrCreateCollateral(collateralType, event)
  collateral.debtAmount = collateral.debtAmount.plus(deltaDebt)
  collateral.save()

  // Check the wad rad multiplication confusion here: https://github.com/reflexer-labs/geb/blob/9501696ca6908f0a7e47f59ed1d50c34c0c6c404/src/CDPEngine.sol#L483
  let deltaTotalIssuedDebt = deltaDebt.times(collateral.accumulatedRate)
  let internalCollateralBalance = getOrCreateCollateralBalance(event.params.debtCounterparty, collateralType, event)
  updateCollateralBalance(
    internalCollateralBalance,
    internalCollateralBalance.balance.minus(deltaTotalIssuedDebt),
    event,
  )
  internalCollateralBalance.save()

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
