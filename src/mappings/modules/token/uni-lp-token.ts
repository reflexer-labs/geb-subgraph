import { Address, dataSource, log } from '@graphprotocol/graph-ts'
import { Transfer } from '../../../../generated/UniLPToken/ERC20'
import { ERC20Transfer } from '../../../../generated/schema'
import { getOrCreateERC20Balance } from '../../../entities/erc20'

import * as decimal from '../../../utils/decimal'
import { eventUid } from '../../../utils/ethereum'

const UNISWAP_POOL_TOKEN_COIN_LABEL = 'UNISWAP_POOL_TOKEN_COIN'
export function handleTransfer(event: Transfer): void {
  let tokenAddress = dataSource.address()

  let source = event.params.from
  let destination = event.params.to
  let amount = decimal.fromWad(event.params.value)
  let nullAddress = Address.fromHexString('0x0000000000000000000000000000000000000000')

  // Check if it's not a burn before updating destination
  if (!destination.equals(nullAddress)) {
    let destBalance = getOrCreateERC20Balance(
      destination,
      tokenAddress,
      event,
      true,
      UNISWAP_POOL_TOKEN_COIN_LABEL,
    )
    destBalance.balance = destBalance.balance.plus(amount)
    destBalance.modifiedAt = event.block.timestamp
    destBalance.modifiedAtBlock = event.block.number
    destBalance.modifiedAtTransaction = event.transaction.hash
    destBalance.save()
  } else {
    // Burn
  }

  // Check if it's not a mint before updating source
  if (!source.equals(nullAddress)) {
    let srcBalance = getOrCreateERC20Balance(source, tokenAddress, event, false)
    srcBalance.balance = srcBalance.balance.minus(amount)
    srcBalance.modifiedAt = event.block.timestamp
    srcBalance.modifiedAtBlock = event.block.number
    srcBalance.modifiedAtTransaction = event.transaction.hash
    srcBalance.save()
  } else {
    // Mint
  }

  // Create a transfer object
  let transfer = new ERC20Transfer(eventUid(event))
  transfer.tokenAddress = tokenAddress
  transfer.source = source
  transfer.destination = destination
  transfer.createdAt = event.block.timestamp
  transfer.createdAtBlock = event.block.number
  transfer.createdAtTransaction = event.transaction.hash
  transfer.save()
}
