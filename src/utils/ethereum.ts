import { Address, ethereum } from '@graphprotocol/graph-ts'

export function eventUid(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
}

export let NULL_ADDRESS = Address.fromHexString('0x0000000000000000000000000000000000000000')
