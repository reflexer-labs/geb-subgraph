import { dataSource, log } from '@graphprotocol/graph-ts'
import {
  UpdateResult,
  Medianizer as ChainlinkMedianizer,
  ModifyParameters,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/EthMedianizer/Medianizer'
import { Medianizer as UniMedianizer } from '../../../../generated/CoinMedianizer/Medianizer'
import {
  getOrCreateCollateral,
  getSystemState,
  MedianizerUpdate,
} from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import { addressMap } from '../../../utils/addresses'
import { ETH_A } from '../../../utils/bytes'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import { periodicHandler } from '../core/periodic-handler'

// Called for both Chainlink and Uniswap medianizer
export function handleUpdateResult(event: UpdateResult): void {
  let id = eventUid(event)
  let update = new MedianizerUpdate(id)
  let contractAddress = dataSource.address()

  update.medianizerAddress = contractAddress
  update.value = decimal.fromWad(event.params.medianPrice)
  update.symbol = ChainlinkMedianizer.bind(contractAddress)
    .symbol()
    .toString()
  update.createdAt = event.block.timestamp
  update.createdAtBlock = event.block.number
  update.createdAtTransaction = event.transaction.hash
  update.save()

  if (contractAddress.equals(addressMap.get('MEDIANIZER_ETH'))) {
    let collateral = getOrCreateCollateral(ETH_A, event)
    collateral.currentMedianizerUpdate = id
    collateral.save()
  } else if (contractAddress.equals(addressMap.get('MEDIANIZER_RAI'))) {
    let system = getSystemState(event)
    system.currentCoinMedianizerUpdate = id
    system.save()
  } else {
    log.error('Medianizer address not found', [])
  }

  // Since the medianizers are called often, call the periodic handler from here
  // to create historical data.
  periodicHandler(event) 
}

// Only call for the Uniswap medianizer
export function handleModifyParameters(event: ModifyParameters): void {
  let uniswapMedian = UniMedianizer.bind(dataSource.address())
  let pairAddress = uniswapMedian.uniswapPair()

  // Set system reference to Coin medianizer
  let system = getSystemState(event)
  system.coinUniswapPair = pairAddress.toHexString()
  system.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
