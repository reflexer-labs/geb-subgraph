import { UserProxy, User, SafeHandlerOwner } from '../../../../generated/schema'
import { Created } from '../../../../generated/ProxyFactory/DSProxyFactory'
import { getOrCreateUser, getSystemState } from '../../../entities'

import * as integer from '../../../utils/integer'
import { Bytes } from '@graphprotocol/graph-ts'

export function handleCreated(event: Created): void {
  let user = getOrCreateUser(event.params.owner)

  // Register new user proxy
  let proxy = new UserProxy(event.params.proxy.toHexString())
  proxy.address = event.params.proxy
  proxy.cache = event.params.cache
  proxy.owner = user.id
  proxy.save()

  // Update system state
  let system = getSystemState(event)
  system.proxyCount = system.proxyCount.plus(integer.ONE)
  system.save()
}

export function findProxy(address: Bytes): UserProxy {
  let proxy = UserProxy.load(address.toHexString())

  if (proxy) {
    return proxy as UserProxy
  } else {
    let handler = SafeHandlerOwner.load(address.toHexString())
    if (handler) {
      proxy = UserProxy.load(handler.owner)
      return proxy as UserProxy
    } else {
      return null
    }
  }
}
