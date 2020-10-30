import { Bytes, ethereum, Address, BigInt, log } from '@graphprotocol/graph-ts'
import { Safe, UserProxy, SafeHandlerOwner } from '../../generated/schema'
import { getOrCreateCollateral } from './collateral'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'
import { getSystemState } from './system'
import { getOrCreateUser } from './user'

// There is 4 different SAFE ownership relation possible:
// 1. Owner -> SAFEEngine
// 2. Owner -> SAFEManager -> SAFEEngine
// 3. Owner -> Proxy -> SAFEEngine
// 4. Owner -> Proxy -> SAFEManager -> SAFEEngine (Like on Oasis)

export function createManagedSafe(
  safeHandler: Bytes,
  owner: Bytes,
  collateral: Bytes,
  safeId: BigInt,
  event: ethereum.Event,
): Safe {
  let collateralObj = getOrCreateCollateral(collateral, event)
  let system = getSystemState(event)
  let safe = createSafe(safeHandler, collateral, event)
  safe.safeId = safeId

  // Ownership detection for managed SAFEs (See explanations above)
  let proxy = UserProxy.load(owner.toHexString())
  if (proxy != null) {
    // Case 4
    safe.owner = proxy.owner
    safe.proxy = proxy.id
  } else {
    // Case 2
    safe.owner = getOrCreateUser(owner).id
  }

  // Add an entry to the reverse lookup data structure
  let handlerOwner = new SafeHandlerOwner(safeHandler.toHexString())
  handlerOwner.owner = safe.owner
  handlerOwner.save()

  // Increase SAFE counters
  collateralObj.safeCount = collateralObj.safeCount.plus(integer.ONE)
  system.safeCount = system.safeCount.plus(integer.ONE)

  collateralObj.save()
  system.save()
  safe.save()

  return safe
}

export function createUnmanagedSafe(
  safeHandler: Bytes,
  collateral: Bytes,
  event: ethereum.Event,
): Safe {
  let collateralObj = getOrCreateCollateral(collateral, event)
  let system = getSystemState(event)
  let safe = createSafe(safeHandler, collateral, event)

  // Ownership detection for unmanaged SAFE (See explanation above)
  let proxy = UserProxy.load(safeHandler.toHexString())
  if (proxy != null) {
    // Case 3
    safe.owner = proxy.owner
    safe.proxy = proxy.id
  } else {
    // Case 1
    safe.owner = getOrCreateUser(safeHandler).id
  }

  // Add an entry to the reverse lookup data structure
  let handlerOwner = new SafeHandlerOwner(safeHandler.toHexString())
  handlerOwner.owner = safe.owner
  handlerOwner.save()

  // Increase SAFE counters
  collateralObj.unmanagedSafeCount = collateralObj.unmanagedSafeCount.plus(integer.ONE)
  system.unmanagedSafeCount = system.unmanagedSafeCount.plus(integer.ONE)


  collateralObj.save()
  system.save()
  safe.save()

  return safe
}

function createSafe(safeHandler: Bytes, collateral: Bytes, event: ethereum.Event): Safe {
  let id = safeHandler.toHexString() + '-' + collateral.toString()

  let safe = new Safe(id)
  safe.collateralType = collateral.toString()
  safe.collateral = decimal.ZERO
  safe.debt = decimal.ZERO
  safe.safeHandler = safeHandler
  safe.createdAt = event.block.timestamp
  safe.createdAtBlock = event.block.number
  safe.createdAtTransaction = event.transaction.hash
  return safe
}

export function updateSafeCollateralization(
  safe: Safe,
  collateral: decimal.BigDecimal,
  debt: decimal.BigDecimal,
  event: ethereum.Event,
): void {
  let wasEmpty = isEmptySafe(safe)

  safe.collateral = collateral
  safe.debt = debt

  let system = getSystemState(event)

  if (wasEmpty && !isEmptySafe(safe)) {
    system.totalActiveSafeCount = system.totalActiveSafeCount.plus(integer.ONE)
  } else if (!wasEmpty && isEmptySafe(safe)) {
    system.totalActiveSafeCount = system.totalActiveSafeCount.minus(integer.ONE)
  }

  updateLastModifySafe(safe, event)

  safe.save()
  system.save()
}

// @ts-ignore
function isEmptySafe(safe: Safe): bool {
  return safe.collateral.equals(decimal.ZERO) && safe.debt.equals(decimal.ZERO)
}

export function updateLastModifySafe(safe: Safe, event: ethereum.Event): void {
  safe.modifiedAt = event.block.timestamp
  safe.modifiedAtBlock = event.block.number
  safe.modifiedAtTransaction = event.transaction.hash
}
