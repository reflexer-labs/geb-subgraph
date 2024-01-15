import { dataSource, log } from '@graphprotocol/graph-ts'

import {
  GebSafeManager,
  TransferSAFEOwnership,
  OpenSAFE,
  AllowSAFE,
  AllowHandler,
} from '../../../../generated/GebSafeManager/GebSafeManager'
import {
  CollateralType,
  Safe,
  InternalCoinBalance,
  InternalDebtBalance,
  InternalCollateralBalance,
  UserProxy,
} from '../../../../generated/schema'

import { updateLastModifySafe, createManagedSafe } from '../../../entities/safe'
import { findUltimateOwner } from '../../../entities/user'

export function handleOpenSAFE(event: OpenSAFE): void {
  let manager = GebSafeManager.bind(dataSource.address())

  let collateralType = manager.collateralTypes(event.params.safe)
  let safeAddress = manager.safes(event.params.safe)

  let collateral = CollateralType.load(collateralType.toString())

  if (collateral != null) {
    // Register new vault
    let safe = createManagedSafe(
      safeAddress,
      event.params.own,
      collateralType,
      event.params.safe,
      event,
    )
    if (safe != null) {
      log.info('New Manged SAFE, owner {}, address: {}', [
        // safe.safeId.toString(),
        safe.owner,
        safeAddress.toHexString(),
      ])
      safe.save()
    }
  } else {
    log.warning('Wrong collateral type: {}, safe_id: {}, tx_hash: {}', [
      collateralType.toString(),
      event.params.safe.toString(),
      event.transaction.hash.toHexString(),
    ])
  }
}

export function handleTransferSAFEOwnership(event: TransferSAFEOwnership): void {
  let manager = GebSafeManager.bind(dataSource.address())
  let collateralType = manager.collateralTypes(event.params.safe)
  let collateral = CollateralType.load(collateralType.toString())
  if (collateral != null) {
    let safeHandler = manager.safes(event.params.safe)
    let safe = Safe.load(safeHandler.toHexString() + '-' + collateral.id)
    if (safe != null) {
      safe.owner = findUltimateOwner(event.params.dst).toHexString()
      updateLastModifySafe(safe as Safe, event)
    
      // Assign a proxy if it exists
      let proxy = UserProxy.load(event.params.dst.toHexString())
      if (proxy != null) {
        safe.proxy = proxy.id
      }
    
      safe.save()
    
      // Transfers balances ownership
      let coinBalance = InternalCoinBalance.load(safeHandler.toHexString())
      if (coinBalance) {
        coinBalance.owner = safe.owner
        coinBalance.save()
      }
    
      let debtBalance = InternalDebtBalance.load(safeHandler.toHexString())
      if (debtBalance) {
        debtBalance.owner = safe.owner
        debtBalance.save()
      }
    
      let collateralBalance = InternalCollateralBalance.load(
        safeHandler.toHexString() + '-' + collateralType.toString(),
      )
      if (collateralBalance) {
        collateralBalance.owner = safe.owner
        collateralBalance.save()
      }
    }
  }
}

export function handleAllowSAFE(event: AllowSAFE): void {
  // TODO:
  log.warning('AllowSAFE not implemented', [])
}

export function handleAllowHandler(event: AllowHandler): void {
  // TODO:
  log.warning('AllowHandler not implemented', [])
}
