import { log } from '@graphprotocol/graph-ts'

import { DeployCDPEngineCall, GebDeploy } from '../../../../generated/GebDeploy/GebDeploy'

export function handleDeployCDPEngine(call: DeployCDPEngineCall): void {
  let cdpEngine = GebDeploy.bind(call.to)
  let address = cdpEngine.cdpEngine()
  // TODO: Create CDPEngine from template
  //CDPEngine.create(address)
  log.info('CDPEngine deployed at: {}', [address.toHexString()])
}
