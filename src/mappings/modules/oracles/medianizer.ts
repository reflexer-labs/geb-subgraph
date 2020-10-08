import { dataSource } from '@graphprotocol/graph-ts'
import { UpdateResult, Medianizer } from '../../../../generated/EthMedianizer/Medianizer'
import { MedianizerUpdate } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'

export function handleUpdateResult(event: UpdateResult): void {
  let update = new MedianizerUpdate(eventUid(event))
  let contractAddress = dataSource.address()

  update.medianizerAddress = contractAddress
  update.value = decimal.fromWad(event.params.medianPrice)
  update.symbol = Medianizer.bind(contractAddress)
    .symbol()
    .toString()
  update.createdAt = event.block.timestamp
  update.createdAtBlock = event.block.number
  update.createdAtTransaction = event.transaction.hash
  update.save()
}
