import { CollateralType, Cdp, SystemState } from '../entities'
import { ethereum } from '@graphprotocol/graph-ts'

// TODO: historical entities

export function updateLastModifyCdp(cdp: Cdp, event: ethereum.Event): void {
  cdp.modifiedAt = event.block.timestamp
  cdp.modifiedAtBlock = event.block.number
  cdp.modifiedAtTransaction = event.transaction.hash
}

export function updateLastModifyCollateralType(collateral: CollateralType, event: ethereum.Event): void {
  collateral.modifiedAt = event.block.timestamp
  collateral.modifiedAtBlock = event.block.number
  collateral.modifiedAtTransaction = event.transaction.hash
}

export function updateLastModifySystemState(system: SystemState, event: ethereum.Event): void {
  system.modifiedAt = event.block.timestamp
  system.modifiedAtBlock = event.block.number
  system.modifiedAtTransaction = event.transaction.hash
}
