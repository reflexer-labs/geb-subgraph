import { dataSource, log } from '@graphprotocol/graph-ts'
import { UpdateResult } from '../../../../generated/EthOsm/Osm'
import { FsmUpdate, getOrCreateCollateral, getSystemState } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import { addresses } from '../../../utils/addresses'
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

  if (contractAddress.equals(addresses.get('FEED_SECURITY_MODULE_ETH'))) {
    let collateral = getOrCreateCollateral(ETH_A, event)
    collateral.currentFsmUpdate = id
    collateral.save()
  } else if (contractAddress.equals(addresses.get('FEED_SECURITY_MODULE_PRAI'))) {
    let system = getSystemState(event)
    system.currentCoinFsmUpdate = id
    system.save()
  } else {
    log.error('FSM address not found', [])
  }
}
