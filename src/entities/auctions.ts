import { Bytes, log, Address } from '@graphprotocol/graph-ts'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'
import * as bytes from '../utils/bytes'
import * as enums from '../utils/enums'
import { EnglishAuctionConfiguration } from '.'
import { DebtAuctionHouse } from '../../generated/DebtAuctionHouse/DebtAuctionHouse'
import { SurplusAuctionHouse } from '../../generated/SurplusAuctionHouse/SurplusAuctionHouse'
import { StakedTokenAuctionHouse } from '../../generated/StakedTokenAuctionHouse/StakedTokenAuctionHouse'

export function getOrCreateEnglishAuctionConfiguration(
  houseAddress: Bytes,
  configId: string,
): EnglishAuctionConfiguration {
  let config = EnglishAuctionConfiguration.load(configId)
  if (config == null) {
    log.info('Creating a new english auction configuration for {}', [configId])
    config = new EnglishAuctionConfiguration(configId)
  }

  // Pull config from the auction contract
  if (configId == enums.EnglishAuctionType_DEBT) {
    let contract = DebtAuctionHouse.bind(bytes.toAddress(houseAddress))
    config.bidIncrease = decimal.fromWad(contract.bidDecrease())
    config.bidDuration = contract.bidDuration()
    config.totalAuctionLength = contract.totalAuctionLength()
    config.DEBT_amountSoldIncrease = decimal.fromWad(contract.amountSoldIncrease())
  } else if (configId == enums.EnglishAuctionType_SURPLUS) {
    let contract = SurplusAuctionHouse.bind(bytes.toAddress(houseAddress))
    config.bidIncrease = decimal.fromWad(contract.bidIncrease())
    config.bidDuration = contract.bidDuration()
    config.totalAuctionLength = contract.totalAuctionLength()
  } else if (configId == enums.EnglishAuctionType_STAKED_TOKEN) {
    let contract = StakedTokenAuctionHouse.bind(bytes.toAddress(houseAddress))
    config.bidIncrease = decimal.fromWad(contract.bidIncrease())
    config.bidDuration = contract.bidDuration()
    config.totalAuctionLength = contract.totalAuctionLength()
  }

  config.save()

  return config as EnglishAuctionConfiguration
}
