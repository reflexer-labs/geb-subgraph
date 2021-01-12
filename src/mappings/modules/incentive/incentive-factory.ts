import {
  AddAuthorization,
  Deploy,
  RemoveAuthorization,
  StakingRewardsFactory,
} from '../../../../generated/StakingRewardsFactory/StakingRewardsFactory'
import { StakingRewards } from '../../../../generated/templates'
import { IncentiveCampaign } from '../../../entities'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// Deploy a new staking contract to index
export function handleDeploy(event: Deploy): void {
  let contract = StakingRewardsFactory.bind(event.address)
  let campaignNumber = event.params.campaignNumber
  let campaignInfo = contract.stakingRewardsInfo(campaignNumber)

  let campaign = new IncentiveCampaign(campaignInfo.value0.toHexString())
  campaign.campaignAddress = campaignInfo.value0
  campaign.campaignNumber = campaignNumber
  campaign.rewardsDuration = event.params.duration
  campaign.periodFinish = integer.ZERO
  campaign.rewardRate = decimal.ZERO
  campaign.totalSupply = decimal.ZERO
  campaign.rewardToken = contract.rewardsToken()
  campaign.stakingToken = event.params.stakingToken
  campaign.lastUpdatedTime = integer.ZERO
  campaign.rewardPerTokenStored = decimal.ZERO

  campaign.createdAt = event.block.timestamp
  campaign.createdAtBlock = event.block.number
  campaign.createdAtTransaction = event.transaction.hash
  campaign.modifiedAt = event.block.timestamp
  campaign.modifiedAtBlock = event.block.number
  campaign.modifiedAtTransaction = event.transaction.hash

  campaign.save()

  // Start indexing the new campaign contract
  StakingRewards.create(campaignInfo.value0)
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
