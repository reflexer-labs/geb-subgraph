import { dataSource, BigInt } from '@graphprotocol/graph-ts'
import {
  UpdateResult,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/ChainlinkTwap/CoinTwap'
import { ConverterFeed as ConverterFeed } from '../../../../generated/ChainlinkTwap/ConverterFeed'

import { getSystemState, MedianizerUpdate } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import { addressMap } from '../../../utils/addresses'

import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import { periodicHandler } from '../core/periodic-handler'

// Uniswap Coin medianizer
export function handleUpdateResult(event: UpdateResult): void {
  let id = eventUid(event)
  let update = new MedianizerUpdate(id)
  let contractAddress = dataSource.address()
  let converterFeedAddress = addressMap.get('CONVERTER_FEED')

  update.medianizerAddress = contractAddress

  let result = ConverterFeed.bind(converterFeedAddress).try_getResultWithValidity()

  if (!result.reverted) {
      let priceResult = result.value

      if (priceResult.value1) {
        update.value = decimal.fromWad(priceResult.value0)
    
        update.symbol = 'RAI'
        update.createdAt = event.block.timestamp
        update.createdAtBlock = event.block.number
        update.createdAtTransaction = event.transaction.hash
        update.save()
      
        let system = getSystemState(event)
        system.currentCoinMedianizerUpdate = id
        system.save()
      }
  }
  
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
