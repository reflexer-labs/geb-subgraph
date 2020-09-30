const fs = require('fs')
const exec = require('child_process').exec
const _resolve = require('path').resolve
const axios = require('axios')

// Update ABI the folder by fetching the new ABIs from changelog repo
// Use: node update_abis.js <path to abi folder> <version ig: kovan/0.6.0>

const path = resolve(process.argv[2])
const gebVersion = process.argv[3] || 'kovan/0.6.0'

console.log(`Looking for ABIs in ${path}`)
function httpGet(url) {
  return new Promise(function(resolve, reject) {
    axios.get(url).then(x => resolve(x.data))
  })
}

async function sh(cmd) {
  return new Promise(function(resolve, reject) {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

function resolve(...args) {
  args = args.slice()
  args.unshift('..')
  args.unshift(__dirname)
  return _resolve.apply(null, args)
}

async function main() {
  let files = fs.readdirSync(path)
  files = files.filter(x => x.endsWith('.json'))
  for (let f of files) {
    const abi = await httpGet(
      `https://raw.githubusercontent.com/reflexer-labs/geb-changelog/master/releases/${gebVersion}/median/fixed-discount/abi/${f.slice(
        0,
        -5,
      )}.abi`,
    )
    fs.writeFileSync(path + '/' + f, JSON.stringify(abi))
  }
  console.log(`prettier -w ${path}/*.json`)
  
  await sh(`prettier -w ${path}/*.json`)
}

main()
