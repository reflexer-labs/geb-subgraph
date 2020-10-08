import { dataSource } from '@graphprotocol/graph-ts'
import { UpdateResult } from '../../../../generated/EthOsm/Osm'
import { FsmUpdate } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'

export function handleUpdateResult(event: UpdateResult): void {
    let update = new FsmUpdate(eventUid(event))
    let contractAddress = dataSource.address()
    update.fsmAddress = contractAddress
    update.value = decimal.fromWad(event.params.newMedian)
    update.createdAt = event.block.timestamp
    update.createdAtBlock = event.block.number
    update.createdAtTransaction = event.transaction.hash
    update.save()
}
