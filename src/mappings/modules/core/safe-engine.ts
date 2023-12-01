import { Address, log, Bytes, ethereum, dataSource } from '@graphprotocol/graph-ts'

import {
  CollateralType,
  Safe,
  ModifySAFECollateralization as ModifySAFECollateralizationEntity,
  ConfiscateSAFECollateralAndDebt as ConfiscateSAFECollateralAndDebtEntity,
  TransferSAFECollateralAndDebt as TransferSAFECollateralAndDebtEntity,
  UpdateAccumulatedRate as UpdateAccumulatedRateEntity,
} from '../../../../generated/schema'

import { SAFEEngine as SAFEEngineBind } from '../../../../generated/SAFEEngine/SAFEEngine'

import { getSystemState } from '../../../entities'

import {
  InitializeCollateralType,
  ModifyParameters as ModifyParameters,
  // ModifyCollateralBalance,
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
import { periodicHandler } from './periodic-handler'
import { addressMap } from '../../../utils/addresses'
import { NULL_ADDRESS } from '../../../utils/ethereum'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// Register a new collateral type
export function handleInitializeCollateralType(event: InitializeCollateralType): void {
  let collateral = getOrCreateCollateral(event.params._cType, event)
  let safeEngineContract = SAFEEngineBind.bind(dataSource.address())

  let cParams = safeEngineContract.cParams(event.params._cType)

  collateral.debtCeiling = decimal.fromRad(cParams.debtCeiling)
  collateral.debtFloor = decimal.fromRad(cParams.debtFloor)
  log.info('Onboard new collateral {}', [collateral.id, collateral.debtCeiling.toString()])

  collateral.save()

  // Update system state
  let system = getSystemState(event)
  let params = safeEngineContract.params()
  system.globalDebtCeiling = decimal.fromRad(params.globalDebtCeiling)
  system.perSafeDebtCeiling = decimal.fromWad(params.safeDebtCeiling)
  system.collateralCount = system.collateralCount.plus(integer.ONE)
  system.save()
}

// Modify collateral type parameters
export function handleModifyParameters(event: ModifyParameters): void {
  let system = getSystemState(event)
  let what = event.params._param.toString()
  let collateralType = event.params._cType.toString()
  let data = event.params._data

  let collateral = CollateralType.load(collateralType)

  if (what == 'globalDebtCeiling') {
    system.globalDebtCeiling = decimal.fromRad(integer.BigInt.fromUnsignedBytes(data))
    system.save()
  } else if (what == 'safeDebtCeiling') {
    system.perSafeDebtCeiling = decimal.fromWad(integer.BigInt.fromUnsignedBytes(data))
    system.save()
  } else if (collateral != null) {
    if (what == 'safetyPrice') {
      // Safety  price is stored on the current price object
    } else if (what == 'debtCeiling') {
      collateral.debtCeiling = decimal.fromRad(integer.BigInt.fromUnsignedBytes(data))
    } else if (what == 'debtFloor') {
      collateral.debtFloor = decimal.fromRad(integer.BigInt.fromUnsignedBytes(data))
    } else if (what == 'liquidationPrice') {
      // Liquidation price is stored on the current price object
    } else {
      return
    }
    collateral.save()
  }
}

// // Modify a user's collateral balance (Called by authorized collateral adapters, mint system coins)
// export function handleModifyCollateralBalance(event: ModifyCollateralBalance): void {
//   let account = event.params._account
//   let collateral = event.params._cType
//   let amount = decimal.fromWad(event.params._wad)

//   // Update user balance
//   updateCollateralBalance(account, collateral, event)

//   // Update collateral counter
//   let collateralObj = getOrCreateCollateral(collateral, event)
//   collateralObj.totalCollateral = collateralObj.totalCollateral.plus(amount)
//   collateralObj.save()
// }

// Transfer collateral between users
export function handleTransferCollateral(event: TransferCollateral): void {
  let collateral = event.params._cType

  updateCollateralBalance(event.params._src, collateral, event)
  updateCollateralBalance(event.params._dst, collateral, event)
}

// Transfer reflexer coin between users
export function handleTransferInternalCoins(event: TransferInternalCoins): void {
  updateCoinBalance(event.params._src, event)
  updateCoinBalance(event.params._dst, event)
}

// Create or modify a SAFE
export function handleModifySAFECollateralization(event: ModifySAFECollateralization): void {
  let collateralType = event.params._cType.toString()
  let safeAddress = event.params._safe
  let deltaCollateral = decimal.fromWad(event.params._deltaCollateral)
  let deltaDebt = decimal.fromWad(event.params._deltaDebt)

  let collateralBalance = deltaCollateral
  let safeId = safeAddress.toHexString() + '-' + collateralType
  let safe = Safe.load(safeId)

  if (safe == null) {
    // It means that the SafeManager was not used, otherwise they would be a Safe entity already created.
    log.info('New unmanaged: {}', [safeId])
    // Register new unmanaged safe
    safe = createUnmanagedSafe(safeAddress, event.params._cType, event)
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
  let collateral = getOrCreateCollateral(event.params._cType, event)
  collateral.debtAmount = collateral.debtAmount.plus(deltaDebt)
  collateral.totalCollateralLockedInSafes = collateral.totalCollateralLockedInSafes.plus(
    deltaCollateral,
  )
  collateral.totalCollateral = collateral.totalCollateral.plus(
    deltaCollateral
  )
  collateral.save()

  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.plus(deltaDebt)
  system.save()

  // Update balances
  updateCollateralBalance(event.params._collateralSource, event.params._cType, event)
  updateCoinBalance(event.params._debtDestination, event)

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
    event.params._src.toHexString() + '-' + event.params._cType.toString(),
  ) as Safe
  let dstSafe = Safe.load(
    event.params._dst.toHexString() + '-' + event.params._cType.toString(),
  ) as Safe

  if (!srcSafe) {
    log.error('TransferSAFECollateralAndDebt, source safe non existent', [])
    return
  }

  if (!dstSafe) {
    dstSafe = createUnmanagedSafe(event.params._dst, event.params._cType, event)
  }

  updateSafeCollateralization(
    srcSafe,
    srcSafe.collateral.minus(decimal.fromWad(event.params._deltaCollateral)),
    srcSafe.debt.minus(decimal.fromWad(event.params._deltaDebt)),
    event,
  )

  updateSafeCollateralization(
    dstSafe,
    dstSafe.collateral.plus(decimal.fromWad(event.params._deltaCollateral)),
    dstSafe.debt.plus(decimal.fromWad(event.params._deltaDebt)),
    event,
  )

  srcSafe.save()
  dstSafe.save()

  let collateral = getOrCreateCollateral(event.params._cType, event)
  let deltaCollateral = decimal.fromWad(event.params._deltaCollateral)
  let deltaDebt = decimal.fromWad(event.params._deltaDebt)

  let evt = new TransferSAFECollateralAndDebtEntity(eventUid(event))
  evt.collateralType = collateral.id
  evt.dstSafe = event.params._dst.toHexString() + '-' + collateral.id
  evt.srcSafe = event.params._src.toHexString() + '-' + collateral.id
  evt.deltaCollateral = deltaCollateral
  evt.deltaDebt = deltaDebt
  evt.srcHandler = event.params._src
  evt.dstHandler = event.params._dst
  evt.createdAt = event.block.timestamp
  evt.createdAtBlock = event.block.number
  evt.createdAtTransaction = event.transaction.hash
  evt.save()
}

// Liquidate a SAFE
export function handleConfiscateSAFECollateralAndDebt(
  event: ConfiscateSAFECollateralAndDebt,
): void {
  let collateralType = event.params._cType
  let deltaDebt = decimal.fromWad(event.params._deltaDebt)
  let deltaCollateral = decimal.fromWad(event.params._deltaCollateral)

  let safe = Safe.load(event.params._safe.toHexString() + '-' + collateralType.toString())
  if (!safe) {
    log.error('Trying to confiscate non-existing safe {}-{}', [
      event.params._safe.toHexString(),
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
  collateral.totalCollateral = collateral.totalCollateral.plus(
    deltaCollateral
  )
  collateral.save()

  // Update counter party collateral
  updateCollateralBalance(event.params._collateralSource, collateralType, event)

  // Update counter party debt
  updateDebtBalance(event.params._debtDestination, event)

  // Update global debt counter
  let system = getSystemState(event)
  let deltaTotalIssuedDebt = deltaDebt.times(collateral.accumulatedRate)
  system.globalUnbackedDebt = system.globalUnbackedDebt.minus(deltaTotalIssuedDebt)
  system.save()

  let evt = new ConfiscateSAFECollateralAndDebtEntity(eventUid(event))
  evt.safe = safe.id
  evt.safeHandler = event.params._safe
  evt.collateralType = collateral.id
  evt.deltaDebt = deltaDebt
  evt.deltaCollateral = deltaCollateral
  evt.debtCounterparty = event.params._debtDestination
  evt.collateralCounterparty = event.params._collateralSource
  evt.globalUnbackedDebt = system.globalUnbackedDebt
  evt.createdAt = event.block.timestamp
  evt.createdAtBlock = event.block.number
  evt.createdAtTransaction = event.transaction.hash
  evt.save()
}

// Create/destroy equal quantities of reflexer coin and system debt
export function handleSettleDebt(event: SettleDebt): void {
  let rad = decimal.fromRad(event.params._rad)

  let account = event.params._account

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
  let rad = decimal.fromRad(event.params._rad)

  // Update debt counters
  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.plus(rad)
  system.globalUnbackedDebt = system.globalUnbackedDebt.plus(rad)
  system.save()

  // Update coin and debt balances
  updateCoinBalance(event.params._coinDestination, event)
  updateDebtBalance(event.params._debtDestination, event)
}

// Modify the debt multiplier, creating/destroying corresponding debt
export function handleUpdateAccumulatedRate(event: UpdateAccumulatedRate): void {
  let rate = decimal.fromRay(event.params._rateMultiplier)
  let collateral = getOrCreateCollateral(event.params._cType, event)

  // Set the new rate
  let accumulatedRate = collateral.accumulatedRate.plus(rate)
  let debtAmount = collateral.debtAmount
  collateral.accumulatedRate = accumulatedRate
  collateral.save()

  // Update debt counter
  let system = getSystemState(event)
  let deltaSurplus = debtAmount.times(rate)
  let debtAddition = system.globalDebt.plus(deltaSurplus)
  system.globalDebt = debtAddition
  system.save()

  // Update the balance
  updateCoinBalance(event.params._surplusDst, event)

  // This needs tbe call at least once an hour. We call it from here since it's a popular function.
  periodicHandler(event)

  let rateEvent = new UpdateAccumulatedRateEntity(eventUid(event))
  rateEvent.collateralType = collateral.id
  rateEvent.rateMultiplier = rate
  rateEvent.accumulatedRate = accumulatedRate
  rateEvent.globalDebt = debtAddition
  rateEvent.createdAt = event.block.timestamp
  rateEvent.createdAtBlock = event.block.number
  rateEvent.createdAtTransaction = event.transaction.hash
  rateEvent.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params._account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params._account, event)
}
