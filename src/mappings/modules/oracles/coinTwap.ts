import { dataSource, BigInt } from '@graphprotocol/graph-ts'
import {
  UpdateResult,
  CoinTwap,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/CoinTwap/CoinTwap'
import { getSystemState, MedianizerUpdate } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import { periodicHandler } from '../core/periodic-handler'

// Uniswap Coin medianizer
export function handleUpdateResult(event: UpdateResult): void {
  let id = eventUid(event)
  let update = new MedianizerUpdate(id)
  let contractAddress = dataSource.address()

  update.medianizerAddress = contractAddress

  // Convert from a 8th decimal place number
  update.value = event.params.result.divDecimal(
    BigInt.fromI32(10)
      .pow(8)
      .toBigDecimal(),
  )
  
  update.symbol = CoinTwap.bind(contractAddress)
    .symbol()
    .toString()
  update.createdAt = event.block.timestamp
  update.createdAtBlock = event.block.number
  update.createdAtTransaction = event.transaction.hash
  update.save()

  let system = getSystemState(event)
  system.currentCoinMedianizerUpdate = id
  system.save()

  // Since the medianizers are called often, call the periodic handler from here
  // to create historical data.
  periodicHandler(event)
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
