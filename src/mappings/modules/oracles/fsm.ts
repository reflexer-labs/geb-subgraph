import { dataSource } from '@graphprotocol/graph-ts'
import { UpdateResult } from '../../../../generated/EthOsm/Osm'
import { FsmUpdate, getOrCreateCollateral, getSystemState } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import { addresses } from '../../../utils/addresses.template'
import { ETH_A } from '../../../utils/bytes'

export function handleUpdateResult(event: UpdateResult): void {
  let id = eventUid(event)
  let update = new FsmUpdate(id)
  let contractAddress = dataSource.address()
  update.fsmAddress = contractAddress
  update.value = decimal.fromWad(event.params.newMedian)
  update.createdAt = event.block.timestamp
  update.createdAtBlock = event.block.number
  update.createdAtTransaction = event.transaction.hash
  update.save()

  if (contractAddress.toHexString().toLocaleLowerCase() === addresses.FEED_SECURITY_MODULE_ETH.toLocaleLowerCase()) {
    let collateral = getOrCreateCollateral(ETH_A, event)
    collateral.currentFsmUpdate = id
    collateral.save()
  } (contractAddress.toHexString().toLocaleLowerCase() === addresses.FEED_SECURITY_MODULE_PRAI.toLocaleLowerCase()) {
    let system = getSystemState(event)
    system.currentCoinFsmUpdate = id
    system.save()
  }
}
