import { dataSource } from '@graphprotocol/graph-ts'
import {
  UpdateResult,
  Medianizer as CoinMedianizer,
  ModifyParameters,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/CoinMedianizer/Medianizer'
import { Medianizer as UniMedianizer } from '../../../../generated/CoinMedianizer/Medianizer'
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
  update.value = decimal.fromWad(event.params.medianPrice)
  update.symbol = CoinMedianizer.bind(contractAddress)
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
