import { Address, ethereum, log } from '@graphprotocol/graph-ts'
import { GebAuthorization } from '../../../entities'
import { addressLabels, addressValues } from '../../../utils/addresses'
import { NULL_ADDRESS } from '../../../utils/ethereum'

export function addAuthorization(account: Address, event: ethereum.Event): void {
  let authId = event.address.toHexString() + '-' + account.toHexString()
  let auth = GebAuthorization.load(authId)

  if (auth) {
    auth.isAuthorized = true
    auth.modifiedAt = event.block.timestamp
    auth.modifiedAtBlock = event.block.number
    auth.modifiedAtTransaction = event.transaction.hash
  } else {
    auth = new GebAuthorization(authId)

    auth.contract = event.address
    auth.contractLabel = getAddressLabel(event.address)
    auth.account = account
    auth.accountLabel = getAddressLabel(account)
    auth.isAuthorized = true

    auth.createdAtBlock = event.block.number
    auth.createdAt = event.block.timestamp
    auth.createdAtTransaction = event.transaction.hash
  }

  auth.save()
}

export function removeAuthorization(account: Address, event: ethereum.Event): void {
  let authId = event.address.toHexString() + '-' + account.toHexString()
  let auth = GebAuthorization.load(authId)

  if (auth) {
    auth.isAuthorized = false
    auth.modifiedAt = event.block.timestamp
    auth.modifiedAtBlock = event.block.number
    auth.modifiedAtTransaction = event.transaction.hash
    auth.save()
  } else {
    log.error('Remove non existing authorization in contract {} for account {}', [
      event.address.toHexString(),
      account.toHexString(),
    ])
  }
}

function getAddressLabel(address: Address): string | null {
  if (address.equals(NULL_ADDRESS)) {
    return 'NULL_ADDRESS'
  }

  for (let i = 0; i < addressLabels.length; i++) {
    if (address.equals(addressValues[i])) {
      return addressLabels[i]
    }
  }
  return null
}
