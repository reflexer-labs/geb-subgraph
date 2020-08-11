import { log } from '@graphprotocol/graph-ts'

import { DeployCDPEngineCall, GebDeploy } from '../../../../generated/GebDeploy/GebDeploy'
import { CDPEngine } from '../../../../generated/templates'

export function handleDeployCDPEngine(call: DeployCDPEngineCall): void {
  let cdpEngine = GebDeploy.bind(call.to)
  let address = cdpEngine.cdpEngine()
  CDPEngine.create(address)
  log.info('CDPEngine deployed at: {}', [address.toHexString()])
}
