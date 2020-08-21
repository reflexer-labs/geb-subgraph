import { Address, Bytes } from '@graphprotocol/graph-ts'

import { User, UserProxy, CdpHandlerOwner } from '../../generated/schema'

export function getOrCreateUser(address: Bytes, persist: boolean = true): User {
  let user = User.load(address.toHexString())

  if (user == null) {
    user = new User(address.toHexString())
    user.address = address

    if (persist) {
      user.save()
    }
  }

  return user as User
}

export function findUltimateOwner(address: Bytes): Bytes {
  // There is 4 different ownership relation possible:
  // 1. Owner -> CDPEngine
  // 2. Owner -> CDPManager -> CDPEngine
  // 3. Owner -> Proxy -> CDPEngine
  // 4. Owner -> Proxy -> CDPManager -> CDPEngine
  
  let proxy = UserProxy.load(address.toHexString())

  if (proxy != null) {
    // Directly owned by proxy
    // Case 3
    return Bytes.fromHexString(proxy.owner) as Bytes
  } else {
    let handler = CdpHandlerOwner.load(address.toHexString())
    if (handler != null) {
      // It's managed
      proxy = UserProxy.load(address.toHexString())
      if (proxy != null) {
        // Case 4
        return Bytes.fromHexString(proxy.owner) as Bytes
      } else {
        // Case 2
        return Bytes.fromHexString(handler.owner) as Bytes
      }
    } else {
      // Unmanaged
      // Case 1
      return address
    }
  }
}
