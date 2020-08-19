import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
} from '../../../../generated/AccountingEngine/AccountingEngine'
import { getAccountingEngine } from '../../../entities/system'

export function handleModifyParametersAddress(event: ModifyParametersAddress): void {
  let what = event.params.parameter.toString()
  let data = event.params.data
  let accounting = getAccountingEngine(event)

  if (what == 'surplusAuctionHouse') {
    accounting.surplusAuctionHouse = data
  } else if (what == 'debtAuctionHouse') {
    accounting.debtAuctionHouse = data
  } else if (what == 'postSettlementSurplusDrain') {
    accounting.postSettlementSurplusDrain = data
  } else if (what == 'protocolTokenAuthority') {
    accounting.protocolTokenAuthority = data
  }
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()
  let data = event.params.data
  let accounting = getAccountingEngine(event)

  if (what == 'surplusAuctionDelay') {
    accounting.surplusAuctionDelay = data
  } else if (what == 'popDebtDelay') {
    accounting.popDebtDelay = data
  } else if (what == 'surplusAuctionAmountToSell') {
    accounting.surplusAuctionAmountToSell = decimal.fromRad(data)
  } else if (what == 'debtAuctionBidSize') {
    accounting.debtAuctionBidSize = decimal.fromRad(data)
  } else if (what == 'initialDebtAuctionMintedTokens') {
    accounting.initialDebtAuctionMintedTokens = decimal.fromWad(data)
  } else if (what == 'surplusBuffer') {
    accounting.surplusBuffer = decimal.fromRad(data)
  } else if (what == 'disableCooldown') {
    accounting.disableCooldown = data
  }
}
