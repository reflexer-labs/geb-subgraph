import Axios from 'axios'
import { ethers } from 'ethers'
import { Geb } from 'geb.js'

export const graphQuery = async query => {
  const url = process.env.SUBGRAPH_NODE_URL
  try {
    const resp = await Axios.post(url as string, {
      query,
    })
    return resp.data.data
  } catch (err) {
    const message = `Error querying graph node: ${err}`
    throw new Error(message)
  }
}

export const getGeb = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC)
  let network = (await provider.getNetwork()).name

  return new Geb(network as 'kovan' | 'mainnet', provider)
}

export const  stringToWad = (str: string) => {
  return ethers.FixedNumber.fromString(str).toFormat
}
