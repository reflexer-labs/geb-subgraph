import { Address, Bytes } from '@graphprotocol/graph-ts'

import { CollateralType, Cdp, UserProxy } from '../../../../generated/schema'

import { getSystemState } from '../../../entities'

import {
  InitializeCollateralType,
  ModifyParameters as ModifyParametersCollateralTypeUint,
  ModifyParameters1 as ModifyParametersUint,
} from '../../../../generated/templates/CDPEngine/CDPEngine'

import * as bytes from '../../../utils/bytes'
import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { getFunctionSignatureFormInput, functionSignature } from '../../../utils/ethereum'

// Register a new collateral type
export function handleInitializeCollateralType(event: InitializeCollateralType): void {
  let collateral = new CollateralType(event.params.collateralType.toString())
  collateral.debtCeiling = decimal.ZERO
  collateral.debtFloor = decimal.ZERO
  collateral.debtAmount = decimal.ZERO

  // TODO: auction parameter init

  collateral.liquidationPenalty = decimal.ZERO
  collateral.liquidationRatio = decimal.ZERO

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
export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {
  let system = getSystemState(event)
  let what = event.params.parameter.toString()
  let data = event.params.data

  if (what == 'globalDebtCeiling') {
    system.totalDebtCeiling = decimal.fromRad(data)
    system.save()
  }
}

export function handleModifyParametersUint(event: ModifyParametersUint) {
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
export function handleSlip(event: LogNote): void {
  // TODO
}

// Transfer collateral between users
export function handleFlux(event: LogNote): void {
  // TODO
}

// Transfer stablecoin between users
export function handleMove(event: LogNote): void {
  // TODO
}

// Create or modify a Vault
export function handleFrob(event: LogNote): void {
  let ilk = event.params.arg1.toString()
  let urn = bytes.toAddress(event.params.arg2)
  let dink = bytes.toSignedInt(<Bytes>event.params.data.subarray(132, 164))
  let dart = bytes.toSignedInt(<Bytes>event.params.data.subarray(164, 196))

  let collateral = CollateralType.load(ilk)

  if (collateral != null) {
    let debt = decimal.fromWad(dart)
    let collateralBalance = decimal.fromWad(dink)

    let vaultId = urn.toHexString() + '-' + ilk
    let vault = Vault.load(vaultId)

    let system = getSystemState(event)

    if (vault == null) {
      // Register new unmanaged vault
      let proxy = UserProxy.load(urn.toHexString())

      vault = new Vault(vaultId)
      vault.collateralType = collateral.id
      vault.collateral = decimal.ZERO
      vault.debt = decimal.ZERO
      vault.handler = urn

      vault.owner = proxy != null ? Address.fromString(proxy.owner) : urn

      vault.openedAt = event.block.timestamp
      vault.openedAtBlock = event.block.number
      vault.openedAtTransaction = event.transaction.hash

      collateral.unmanagedVaultCount = collateral.unmanagedVaultCount.plus(integer.ONE)

      system.unmanagedVaultCount = system.unmanagedVaultCount.plus(integer.ONE)
    } else {
      // Update existing Vault
      vault.collateral = vault.collateral.plus(collateralBalance)
      vault.debt = vault.debt.plus(debt)

      vault.modifiedAt = event.block.timestamp
      vault.modifiedAtBlock = event.block.number
      vault.modifiedAtTransaction = event.transaction.hash
    }

    collateral.totalDebt = collateral.totalDebt.plus(debt)

    collateral.modifiedAt = event.block.timestamp
    collateral.modifiedAtBlock = event.block.number
    collateral.modifiedAtTransaction = event.transaction.hash

    vault.save()
    collateral.save()
    system.save()
  }
}

// Split a Vault - binary approval or splitting/merging Vaults
export function handleFork(event: LogNote): void {
  // TODO
}

// Liquidate a Vault
export function handleGrab(event: LogNote): void {
  // TODO
}

// Create/destroy equal quantities of stablecoin and system debt
export function handleHeal(event: LogNote): void {
  let rad = decimal.fromRad(bytes.toUnsignedInt(event.params.arg1))

  let system = getSystemState(event)
  system.totalDebt = system.totalDebt.minus(rad)
  system.save()
}

// Mint unbacked stablecoin
export function handleSuck(event: LogNote): void {
  let rad = decimal.fromRad(bytes.toUnsignedInt(event.params.arg3))

  let system = getSystemState(event)
  system.totalDebt = system.totalDebt.plus(rad)
  system.save()
}

// Modify the debt multiplier, creating/destroying corresponding debt
export function handleFold(event: LogNote): void {
  let ilk = event.params.arg1.toString()
  let rate = decimal.fromRay(bytes.toSignedInt(event.params.arg3))

  let collateral = CollateralType.load(ilk)

  if (collateral != null) {
    let rad = collateral.totalDebt.times(rate)

    collateral.rate = collateral.rate.plus(rate)
    collateral.save()

    let system = getSystemState(event)
    system.totalDebt = system.totalDebt.plus(rad)
    system.save()
  }
}
