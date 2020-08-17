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

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { getOrCreateCollateral } from '../../../entities/collateral'
import { updateLastModifySystemState, updateLastModifyCollateralType, updateLastModifyCdp } from '../../../utils/state'

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

  let collateral = getOrCreateCollateral(event.params.collateralType, event)
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

      cdp.createdAt = event.block.timestamp
      cdp.createdAtBlock = event.block.number
      cdp.createdAtTransaction = event.transaction.hash

      collateral.unmanagedCdpCount = collateral.unmanagedCdpCount.plus(integer.ONE)
      
      if(collateralBalance.gt(decimal.ZERO) || debt.gt(decimal.ZERO)) {
        system.totalActiveCdpCount = system.totalActiveCdpCount.plus(integer.ONE)
      }

      system.unmanagedCdpCount = system.unmanagedCdpCount.plus(integer.ONE)
    } else {
      // Update existing Vault
      log.info('Update cpd collateralization of CDP #{}, address: ', [cdp.cdpId.toString(), cdpAddress.toHexString()])

      cdp.collateral = cdp.collateral.plus(collateralBalance)
      cdp.debt = cdp.debt.plus(debt)

      if(collateralBalance.equals(decimal.ZERO) || debt.equals(decimal.ZERO)) {
        system.totalActiveCdpCount = system.totalActiveCdpCount.minus(integer.ONE)
      }

      updateLastModifyCdp(cdp as Cdp, event)
    }

    collateral.debtAmount = collateral.debtAmount.plus(debt)
    system.globalDebt = system.globalDebt.plus(debt)

    updateLastModifyCollateralType(collateral as CollateralType, event)
    updateLastModifySystemState(system, event)

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
  system.globalDebt = system.globalDebt.minus(rad)
  updateLastModifySystemState(system, event)
  system.save()
}

// Mint unbacked reflexer bonds
export function handleCreateUnbackedDebt(event: CreateUnbackedDebt): void {
  let rad = decimal.fromRad(event.params.rad)

  let system = getSystemState(event)
  system.globalDebt = system.globalDebt.plus(rad)
  system.globalUnbackedDebt = system.globalUnbackedDebt.plus(rad)

  // TODO: update internal balance of src and dst

  updateLastModifySystemState(system, event)
  system.save()
}

// Modify the debt multiplier, creating/destroying corresponding debt
export function handleUpdateAccumulatedRate(event: UpdateAccumulatedRate): void {
  let collateralType = event.params.collateralType.toString()
  let rate = decimal.fromRay(event.params.rateMultiplier)

  let collateral = CollateralType.load(collateralType)

  if (collateral != null) {
    let rad = collateral.debtAmount.times(rate)

    collateral.accumulatedRate = collateral.accumulatedRate.plus(rate)
    updateLastModifyCollateralType(collateral as CollateralType , event)
    collateral.save()

    let system = getSystemState(event)
    system.globalDebt = system.globalDebt.plus(rad)
    updateLastModifySystemState(system, event)
    system.save()
  }
}
