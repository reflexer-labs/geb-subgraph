import { Address, log, Bytes, ethereum } from '@graphprotocol/graph-ts'

import {
  CollateralType,
  Safe,
  ModifySAFECollateralization as ModifySAFECollateralizationEntity,
  ConfiscateSAFECollateralAndDebt as ConfiscateSAFECollateralAndDebtEntity,
  TransferSAFECollateralAndDebt as TransferSAFECollateralAndDebtEntity,
  UpdateAccumulatedRate as UpdateAccumulatedRateEntity,
} from '../../../../generated/schema'

import { getSystemState } from '../../../entities'

import {
  InitializeCollateralType,
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersCollateralTypeUint,
  ModifyCollateralBalance,
  TransferCollateral,
  TransferInternalCoins,
  TransferSAFECollateralAndDebt,
  ConfiscateSAFECollateralAndDebt,
  SettleDebt,
  CreateUnbackedDebt,
  UpdateAccumulatedRate,
  ModifySAFECollateralization,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/SAFEEngine/SAFEEngine'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { getOrCreateCollateral } from '../../../entities/collateral'
import {
  updateCoinBalance,
  updateCollateralBalance,
  updateDebtBalance,
} from '../../../entities/balances'
import { createUnmanagedSafe, updateSafeCollateralization } from '../../../entities/safe'
import { eventUid } from '../../../utils/ethereum'
// import { periodicHandler } from './periodic-handler'
import { addressMap } from '../../../utils/addresses'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// Register a new collateral type
export function handleInitializeCollateralType(event: InitializeCollateralType): void {
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  log.info('Onboard new collateral {}', [collateral.id])

  // Update system state
  let system = getSystemState(event)
  system.collateralCount = system.collateralCount.plus(integer.ONE)
  system.save()
}

// Modify collateral type parameters
export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let system = getSystemState(event)
  let what = event.params.parameter.toString()
  let data = event.params.data

  if (what == 'globalDebtCeiling') {
    system.globalDebtCeiling = decimal.fromRad(data)
    system.save()
  } else if (what == 'safeDebtCeiling') {
    system.perSafeDebtCeiling = decimal.fromWad(data)
    system.save()
  }
}

export function handleModifyParametersCollateralTypeUint(
  event: ModifyParametersCollateralTypeUint,
): void {
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
    collateral.save()
  }
}
// Modify a user's collateral balance (Called by authorized collateral adapters, mint system coins)
export function handleModifyCollateralBalance(event: ModifyCollateralBalance): void {
  let account = event.params.account
  let collateral = event.params.collateralType
  let amount = decimal.fromWad(event.params.wad)

  // Update user balance
  updateCollateralBalance(account, collateral, event)

  // Update collateral counter
  let collateralObj = getOrCreateCollateral(collateral, event)
  collateralObj.totalCollateral = collateralObj.totalCollateral.plus(amount)
  collateralObj.save()
}

// Transfer collateral between users
export function handleTransferCollateral(event: TransferCollateral): void {
  let collateral = event.params.collateralType

  updateCollateralBalance(event.params.src, collateral, event)
  updateCollateralBalance(event.params.dst, collateral, event)
}

// Transfer reflexer coin between users
export function handleTransferInternalCoins(event: TransferInternalCoins): void {
  updateCoinBalance(event.params.src, event)
  updateCoinBalance(event.params.dst, event)
}

// Create or modify a SAFE
export function handleModifySAFECollateralization(event: ModifySAFECollateralization): void {
  let collateralType = event.params.collateralType.toString()
  let safeAddress = event.params.safe
  let deltaCollateral = decimal.fromWad(event.params.deltaCollateral)
  let deltaDebt = decimal.fromWad(event.params.deltaDebt)

  let collateralBalance = deltaCollateral
  let safeId = safeAddress.toHexString() + '-' + collateralType
  let safe = Safe.load(safeId)

  if (safe == null) {
    // It means that the SafeManager was not used, otherwise they would be a Safe entity already created.
    log.info('New unmanaged: {}', [safeId])
    // Register new unmanaged safe
    safe = createUnmanagedSafe(safeAddress, event.params.collateralType, event)
    updateSafeCollateralization(safe as Safe, collateralBalance, deltaDebt, event)
  } else {
    // Update existing Vault
    log.info('Update cpd collateralization of: ', [safe.id])
    updateSafeCollateralization(
      safe as Safe,
      safe.collateral.plus(collateralBalance),
      safe.debt.plus(deltaDebt),
      event,
    )
  }
  safe.save()

  // Update debt and collateral counters
  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  collateral.debtAmount = collateral.debtAmount.plus(deltaDebt)
  collateral.totalCollateralLockedInSafes = collateral.totalCollateralLockedInSafes.plus(
    deltaCollateral,
  )
  collateral.save()

  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.plus(deltaDebt)
  system.save()

  // Update balances
  updateCollateralBalance(event.params.collateralSource, event.params.collateralType, event)
  updateCoinBalance(event.params.debtDestination, event)

  // Create a new modify collateralization update
  let update = new ModifySAFECollateralizationEntity(eventUid(event))
  update.safe = safe.id
  update.safeHandler = safeAddress
  update.collateralType = collateral.id
  update.deltaCollateral = deltaCollateral
  update.deltaDebt = deltaDebt
  update.createdAt = event.block.timestamp
  update.createdAtBlock = event.block.number
  update.accumulatedRate = collateral.accumulatedRate
  update.createdAtTransaction = event.transaction.hash
  update.save()
}

// Split a SAFE - binary approval or splitting/merging Vaults
export function handleTransferSAFECollateralAndDebt(event: TransferSAFECollateralAndDebt): void {
  // Both should be non dusty so they exist
  let srcSafe = Safe.load(
    event.params.src.toHexString() + '-' + event.params.collateralType.toString(),
  ) as Safe
  let dstSafe = Safe.load(
    event.params.dst.toHexString() + '-' + event.params.collateralType.toString(),
  ) as Safe

  if (!srcSafe) {
    log.error('TransferSAFECollateralAndDebt, source safe non existent', [])
    return
  }

  if (!dstSafe) {
    dstSafe = createUnmanagedSafe(event.params.dst, event.params.collateralType, event)
  }

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

  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  let deltaCollateral = decimal.fromWad(event.params.deltaCollateral)
  let deltaDebt = decimal.fromWad(event.params.deltaDebt)

  let evt = new TransferSAFECollateralAndDebtEntity(eventUid(event))
  evt.collateralType = collateral.id
  evt.dstSafe = event.params.dst.toHexString() + '-' + collateral.id
  evt.srcSafe = event.params.src.toHexString() + '-' + collateral.id
  evt.deltaCollateral = deltaCollateral
  evt.deltaDebt = deltaDebt
  evt.srcHandler = event.params.src
  evt.dstHandler = event.params.dst
  evt.createdAt = event.block.timestamp
  evt.createdAtBlock = event.block.number
  evt.createdAtTransaction = event.transaction.hash
  evt.save()
}

// Liquidate a SAFE
export function handleConfiscateSAFECollateralAndDebt(
  event: ConfiscateSAFECollateralAndDebt,
): void {
  let collateralType = event.params.collateralType
  let deltaDebt = decimal.fromWad(event.params.deltaDebt)
  let deltaCollateral = decimal.fromWad(event.params.deltaCollateral)

  let safe = Safe.load(event.params.safe.toHexString() + '-' + collateralType.toString())
  if (!safe) {
    log.error('Trying to confiscate non-existing safe {}-{}', [
      event.params.safe.toHexString(),
      collateralType.toString(),
    ])
    return
  }
  updateSafeCollateralization(
    safe as Safe,
    safe.collateral.plus(deltaCollateral),
    safe.debt.plus(deltaDebt),
    event,
  )
  safe.save()

  // Update collateral debt counter
  let collateral = getOrCreateCollateral(collateralType, event)
  collateral.debtAmount = collateral.debtAmount.plus(deltaDebt)
  collateral.totalCollateralLockedInSafes = collateral.totalCollateralLockedInSafes.plus(
    deltaCollateral,
  )
  collateral.save()

  // Update counter party collateral
  updateCollateralBalance(event.params.collateralCounterparty, collateralType, event)

  // Update counter party debt
  updateDebtBalance(event.params.debtCounterparty, event)

  // Update global debt counter
  let system = getSystemState(event)
  let deltaTotalIssuedDebt = deltaDebt.times(collateral.accumulatedRate)
  system.globalUnbackedDebt = system.globalUnbackedDebt.minus(deltaTotalIssuedDebt)
  system.save()

  let evt = new ConfiscateSAFECollateralAndDebtEntity(eventUid(event))
  evt.safe = safe.id
  evt.safeHandler = event.params.safe
  evt.collateralType = collateral.id
  evt.deltaDebt = deltaDebt
  evt.deltaCollateral = deltaCollateral
  evt.debtCounterparty = event.params.debtCounterparty
  evt.collateralCounterparty = event.params.collateralCounterparty
  evt.globalUnbackedDebt = decimal.fromRad(event.params.globalUnbackedDebt)
  evt.createdAt = event.block.timestamp
  evt.createdAtBlock = event.block.number
  evt.createdAtTransaction = event.transaction.hash
  evt.save()
}

// Create/destroy equal quantities of reflexer coin and system debt
export function handleSettleDebt(event: SettleDebt): void {
  let rad = decimal.fromRad(event.params.rad)

  let account = event.params.account

  // Update debt counters
  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.minus(rad)
  system.globalUnbackedDebt = system.globalUnbackedDebt.minus(rad)
  system.save()

  // Update debt and coin balance
  updateCoinBalance(account, event)
  updateDebtBalance(account, event)
}

// Mint unbacked reflexer coins
export function handleCreateUnbackedDebt(event: CreateUnbackedDebt): void {
  let rad = decimal.fromRad(event.params.rad)

  // Update debt counters
  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.plus(rad)
  system.globalUnbackedDebt = system.globalUnbackedDebt.plus(rad)
  system.save()

  // Update coin and debt balances
  updateCoinBalance(event.params.coinDestination, event)
  updateDebtBalance(event.params.debtDestination, event)
}

// Modify the debt multiplier, creating/destroying corresponding debt
export function handleUpdateAccumulatedRate(event: UpdateAccumulatedRate): void {
  let rate = decimal.fromRay(event.params.rateMultiplier)
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  // Set the new rate
  let accumulatedRate = collateral.accumulatedRate.plus(rate)
  collateral.accumulatedRate = accumulatedRate
  collateral.save()

  // Update debt counter
  let system = getSystemState(event)
  system.globalDebt = decimal.fromRad(event.params.globalDebt)
  system.save()

  // Update the balance
  updateCoinBalance(event.params.surplusDst, event)

  // This needs tbe call at least once an hour. We call it from here since it's a popular function.
  // periodicHandler(event)

  let rateEvent = new UpdateAccumulatedRateEntity(eventUid(event))
  rateEvent.collateralType = collateral.id
  rateEvent.rateMultiplier = rate
  rateEvent.accumulatedRate = accumulatedRate
  rateEvent.globalDebt = decimal.fromRad(event.params.globalDebt)
  rateEvent.createdAt = event.block.timestamp
  rateEvent.createdAtBlock = event.block.number
  rateEvent.createdAtTransaction = event.transaction.hash
  rateEvent.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
