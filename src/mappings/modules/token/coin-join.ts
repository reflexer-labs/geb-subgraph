import { Exit, Join } from '../../../../generated/CoinJoin/CoinJoin'
import { CoinExitTransaction, CoinJoinTransaction, getOrCreateUser } from '../../../entities'
import { eventUid } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import { findUltimateOwner } from '../../../entities/user'

export function handleJoin(event: Join): void {
  let join = new CoinJoinTransaction(eventUid(event))

  join.amount = decimal.fromWad(event.params.wad)
  join.safeHandler = event.params.account
  join.owner = getOrCreateUser(findUltimateOwner(event.params.account)).id
  join.source = event.params.sender
  join.createdAt = event.block.timestamp
  join.createdAtBlock = event.block.number
  join.createdAtTransaction = event.transaction.hash

  join.save()
}

export function handleExit(event: Exit): void {
  let exit = new CoinExitTransaction(eventUid(event))

  exit.amount = decimal.fromWad(event.params.wad)
  exit.safeHandler = event.params.sender
  exit.owner = getOrCreateUser(findUltimateOwner(event.params.sender)).id
  exit.recipient = event.params.account
  exit.createdAt = event.block.timestamp
  exit.createdAtBlock = event.block.number
  exit.createdAtTransaction = event.transaction.hash

  exit.save()
}
