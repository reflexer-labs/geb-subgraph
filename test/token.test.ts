import { Geb, utils } from 'geb.js'
import { getGeb, graphQuery } from './utils'
import assert from 'assert'

describe('Test of core mappings', () => {
  let geb: Geb
  beforeEach(async () => {
    geb = await getGeb()
  })

  it('ERC20 total supply', async () => {
    const graphSupply = (
      await graphQuery(`
        {
          systemState(id: "current")
              {
                erc20CoinTotalSupply
              }
        }
        `)
    ).systemState.erc20CoinTotalSupply

    // We need to subtracts 0x0's balance
    const gebSupply = utils.wadToFixed(
      await (await geb.contracts.coin.totalSupply()).sub(await geb.contracts.coin.balanceOf(utils.NULL_ADDRESS)),
    )

    assert.strictEqual(gebSupply.toString(), graphSupply)
  })
})
