import { Address, log } from '@graphprotocol/graph-ts'

import { CollateralType, Cdp, UserProxy } from '../../../../generated/schema'

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

import * as bytes from '../../../utils/bytes'
import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

// Register a new collateral type
export function handleInitializeCollateralType(event: InitializeCollateralType): void {
  let collateral = new CollateralType(event.params.collateralType.toString())

  log.info('Onboard new collateral {}', [collateral.id])

  collateral.debtCeiling = decimal.ZERO
  collateral.debtFloor = decimal.ZERO
  collateral.debtAmount = decimal.ZERO

  // TODO: auction parameter init

  collateral.liquidationPenalty = decimal.ZERO
  collateral.liquidationCRatio = decimal.ZERO
  collateral.safetyCRatio = decimal.ZERO

  collateral.rate = decimal.ZERO

  collateral.stabilityFee = decimal.ONE

  collateral.unmanagedCdpCount = integer.ZERO
  collateral.cdpCount = integer.ZERO

  collateral.addedAt = event.block.timestamp
  collateral.addedAtBlock = event.block.number
  collateral.addedAtTransaction = event.transaction.hash

  collateral.save()

  // Update system state
  let state = getSystemState(event)
  state.collateralCount = state.collateralCount.plus(integer.ONE)
  state.save()
}

// Modify collateral type parameters
export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let system = getSystemState(event)
  let what = event.params.parameter.toString()
  let data = event.params.data

  if (what == 'globalDebtCeiling') {
    system.totalDebtCeiling = decimal.fromRad(data)
    system.save()
  }
}

export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {
  let system = getSystemState(event)
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

    collateral.modifiedAt = event.block.timestamp
    collateral.modifiedAtBlock = event.block.number
    collateral.modifiedAtTransaction = event.transaction.hash

    collateral.save()
    system.save()
  }
}
// Modify a user's collateral balance
export function handleModifyCollateralBalance(event: ModifyCollateralBalance): void {
  // TODO:
  log.warning('ModifyCollateralBalance called but handler not implemented!', [])
}

// Transfer collateral between users
export function handleTransferCollateral(event: TransferCollateral): void {
  // TODO:
  log.warning('TransferCollateral called but handler not implemented!', [])
}

// Transfer reflexer bond between users
export function handleTransferInternalCoins(event: TransferInternalCoins): void {
  // TODO:
  log.warning('TransferCollateral called but handler not implemented!', [])
}

// Create or modify a CDP
export function handleModifyCDPCollateralization(event: ModifyCDPCollateralization): void {
  let collateralType = event.params.collateralType.toString()
  let cdpAddress = event.params.cdp
  let deltaCollateral = event.params.deltaCollateral
  let deltaDebt = event.params.deltaDebt

  let collateral = CollateralType.load(collateralType)
  if (collateral != null) {
    let debt = decimal.fromWad(deltaDebt)
    let collateralBalance = decimal.fromWad(deltaCollateral)

    let cdpId = cdpAddress.toHexString() + '-' + collateralType
    let cdp = Cdp.load(cdpId)

    let system = getSystemState(event)

    if (cdp == null) {
      log.info('Update cpd collateralization of unmanaged CDP #{}, address: {}', [
        cdp.cdpId.toString(),
        cdpAddress.toHexString(),
      ])
      // Register new unmanaged vault
      let proxy = UserProxy.load(cdpAddress.toHexString())

      cdp = new Cdp(cdpId)
      cdp.collateralType = collateral.id
      cdp.collateral = collateralBalance
      cdp.debt = debt
      cdp.cdpHandler = cdpAddress

      cdp.owner = proxy != null ? Address.fromString(proxy.owner) : cdpAddress

      cdp.openedAt = event.block.timestamp
      cdp.openedAtBlock = event.block.number
      cdp.openedAtTransaction = event.transaction.hash

      collateral.unmanagedCdpCount = collateral.unmanagedCdpCount.plus(integer.ONE)

      system.unmanagedCdpCount = system.unmanagedCdpCount.plus(integer.ONE)
    } else {
      // Update existing Vault
      log.info('Update cpd collateralization of CDP #{}, address: ', [cdp.cdpId.toString(), cdpAddress.toHexString()])

      cdp.collateral = cdp.collateral.plus(collateralBalance)
      cdp.debt = cdp.debt.plus(debt)

      cdp.modifiedAt = event.block.timestamp
      cdp.modifiedAtBlock = event.block.number
      cdp.modifiedAtTransaction = event.transaction.hash
    }

    collateral.debtAmount = collateral.debtAmount.plus(debt)
    system.totalDebt = system.totalDebt.plus(debt)

    collateral.modifiedAt = event.block.timestamp
    collateral.modifiedAtBlock = event.block.number
    collateral.modifiedAtTransaction = event.transaction.hash

    cdp.save()
    collateral.save()
    system.save()
  }
}

// Split a CDP - binary approval or splitting/merging Vaults
export function handleTransferCDPCollateralAndDebt(event: TransferCDPCollateralAndDebt): void {
  // TODO:
  log.warning('TransferCDPCollateralAndDebt called but handler not implemented!', [])
}

// Liquidate a CDP
export function handleConfiscateCDPCollateralAndDebt(event: ConfiscateCDPCollateralAndDebt): void {
  // TODO:
  log.warning('ConfiscateCDPCollateralAndDebt called but handler not implemented!', [])
}

// Create/destroy equal quantities of reflexer bond and system debt
export function handleSettleDebt(event: SettleDebt): void {
  let rad = decimal.fromRad(event.params.rad)

  let system = getSystemState(event)
  system.totalDebt = system.totalDebt.minus(rad)
  system.save()
}

// Mint unbacked reflexer bonds
export function handleCreateUnbackedDebt(event: CreateUnbackedDebt): void {
  let rad = decimal.fromRad(event.params.rad)

  let system = getSystemState(event)
  system.totalDebt = system.totalDebt.plus(rad)
  system.save()
}

// Modify the debt multiplier, creating/destroying corresponding debt
export function handleUpdateAccumulatedRate(event: UpdateAccumulatedRate): void {
  let collateralType = event.params.collateralType.toString()
  let rate = decimal.fromRay(event.params.rateMultiplier)

  let collateral = CollateralType.load(collateralType)

  if (collateral != null) {
    let rad = collateral.debtAmount.times(rate)

    collateral.rate = collateral.rate.plus(rate)
    collateral.save()

    let system = getSystemState(event)
    system.totalDebt = system.totalDebt.plus(rad)
    system.save()
  }
}
