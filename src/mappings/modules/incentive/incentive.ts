import { IncentiveBalance, IncentiveCampaign, UserProxy } from '../../../entities'
import {
  RewardAdded,
  RewardPaid,
  Staked,
  StakingRewards,
  Withdrawn,
} from '../../../../generated/templates/StakingRewards/StakingRewards'
import * as decimal from '../../../utils/decimal'
import { Address, Bytes, ethereum, log } from '@graphprotocol/graph-ts'

// Kick-off the campaign by adding rewards
export function handleRewardAdded(event: RewardAdded): void {
  let campaign = IncentiveCampaign.load(event.address.toHexString())
  if (campaign != null) {
    let contract = StakingRewards.bind(event.address)

    campaign.rewardRate = decimal.fromWad(contract.rewardRate())
    campaign.lastUpdatedTime = event.block.timestamp
    campaign.periodFinish = contract.periodFinish()
    campaign.modifiedAt = event.block.timestamp
    campaign.modifiedAtBlock = event.block.number
    campaign.modifiedAtTransaction = event.transaction.hash
    campaign.save()
  
    log.info('Reward added for campaign {}', [campaign.campaignNumber.toString()])
  }
}

export function handleStaked(event: Staked): void {
  let amount = decimal.fromWad(event.params.amount)
  let campaign = IncentiveCampaign.load(event.address.toHexString())
  if (campaign != null) {
    let contract = StakingRewards.bind(event.address)

    campaign.totalSupply = campaign.totalSupply.plus(amount)

    let incentiveBalId = incentiveBalanceId(event.address, event.params.user)
    let bal = IncentiveBalance.load(incentiveBalId)

    if (!bal) {
      // Create new incentive balance
      bal = new IncentiveBalance(incentiveBalId)
      bal.address = event.params.user
      bal.campaignNumber = campaign.campaignNumber
      bal.campaignAddress = event.address
      bal.stakeBalance = decimal.fromWad(event.params.amount)

      // If the account is a proxy, set the proxy owner as owner.
      let proxy = UserProxy.load(event.params.user.toHexString())
      bal.owner = proxy ? proxy.owner.toString() : null

      bal.createdAt = event.block.timestamp
      bal.createdAtBlock = event.block.number
      bal.createdAtTransaction = event.transaction.hash
    } else {
      bal.stakeBalance = bal.stakeBalance.plus(decimal.fromWad(event.params.amount))
    }

    updateReward(bal as IncentiveBalance, campaign as IncentiveCampaign, contract, event)

    bal.modifiedAt = event.block.timestamp
    bal.modifiedAtBlock = event.block.number
    bal.modifiedAtTransaction = event.transaction.hash

    campaign.save()
    bal.save()
  }
}

export function handleWithdrawn(event: Withdrawn): void {
  let amount = decimal.fromWad(event.params.amount)
  let campaign = IncentiveCampaign.load(event.address.toHexString())
  if (campaign != null) {
    let contract = StakingRewards.bind(event.address)

    campaign.totalSupply = campaign.totalSupply.minus(amount)

    let incentiveBalId = incentiveBalanceId(event.address, event.params.user)
    let bal = IncentiveBalance.load(incentiveBalId)

    if (!bal) {
      log.error('Withdraw from non existing balance {}', [incentiveBalId])
      return
    }

    updateReward(bal as IncentiveBalance, campaign as IncentiveCampaign, contract, event)

    bal.stakeBalance = bal.stakeBalance.minus(amount)

    campaign.save()
    bal.save()
  }
}

export function handleRewardPaid(event: RewardPaid): void {
  let contract = StakingRewards.bind(event.address)

  let incentiveBalId = incentiveBalanceId(event.address, event.params.user)
  let bal = IncentiveBalance.load(incentiveBalId)
  let campaign = IncentiveCampaign.load(event.address.toHexString())
  if (campaign != null) {

    if (!bal) {
      log.error('Withdraw from non existing balance {}', [incentiveBalId])
      return
    }

    updateReward(bal as IncentiveBalance, campaign as IncentiveCampaign, contract, event)
    bal.reward = decimal.ZERO

    campaign.save()
    bal.save()
  }
}

function incentiveBalanceId(campaignAddress: Address, userAddress: Address): string {
  return campaignAddress.toHexString() + '-' + userAddress.toHexString()
}

// Does the job of the updateReward modifier from the staking contract
function updateReward(
  incentiveBalance: IncentiveBalance,
  incentiveCampaign: IncentiveCampaign,
  contract: StakingRewards,
  event: ethereum.Event,
): void {
  // Campaign specific vars
  incentiveCampaign.lastUpdatedTime =
    event.block.timestamp > incentiveCampaign.periodFinish
      ? incentiveCampaign.periodFinish
      : event.block.timestamp

  incentiveCampaign.rewardPerTokenStored = decimal.fromWad(contract.rewardPerTokenStored())

  // User specific vars
  incentiveBalance.reward = decimal.fromWad(contract.rewards(incentiveBalance.address as Address))
  incentiveBalance.userRewardPerTokenPaid = decimal.fromWad(
    contract.userRewardPerTokenPaid(incentiveBalance.address as Address),
  )
}
