import { dataSource, log } from '@graphprotocol/graph-ts'
import {
  AddAuthorization,
  Osm,
  RemoveAuthorization,
  UpdateResult,
} from '../../../../generated/EthOsm/Osm'
import { FsmUpdate, getOrCreateCollateral, getSystemState } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { addressMap } from '../../../utils/addresses'
import { ETH_A } from '../../../utils/bytes'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

export function handleUpdateResult(event: UpdateResult): void {
  let id = eventUid(event)
  let update = new FsmUpdate(id)
  let contractAddress = dataSource.address()
  let fsmContract = Osm.bind(contractAddress)
  update.fsmAddress = contractAddress
  update.value = decimal.fromWad(event.params.newMedian)
  update.nextValue = decimal.fromWad(fsmContract.getNextResultWithValidity().value0)
  update.nextUpdateMinTimestamp = integer
    .fromNumber(fsmContract.updateDelay())
    .plus(event.block.timestamp)
  update.createdAt = event.block.timestamp
  update.createdAtBlock = event.block.number
  update.createdAtTransaction = event.transaction.hash
  update.save()

  if (contractAddress.equals(addressMap.get('FEED_SECURITY_MODULE_ETH'))) {
    let collateral = getOrCreateCollateral(ETH_A, event)
    collateral.currentFsmUpdate = id
    collateral.save()
  } else {
    log.error('FSM address not found', [])
  }
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
