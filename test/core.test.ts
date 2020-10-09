import { Geb, utils } from 'geb.js'
import { getGeb, graphQuery } from './utils'
import assert from 'assert'

describe('Test of core mappings', () => {
  let geb: Geb
  beforeEach(async () => {
    geb = await getGeb()
  })

  it('Global debt', async () => {
    const graphValue = (
      await graphQuery(`
        {
          systemState(id: "current")
              {
                globalDebt
              }
        }
        `)
    ).systemState.globalDebt

    // We need to subtracts 0x0's balance
    const gebValue = utils.radToFixed(await await geb.contracts.safeEngine.globalDebt())

    assert.strictEqual(gebValue.toString(), graphValue)
  })
})
