const fs = require('fs')
const exec = require('child_process').exec
const _resolve = require('path').resolve
const axios = require('axios')
const prettier = require('prettier')

// Update ABI the folder by fetching the new ABIs from changelog repo
// Use: node update_abis.js <path to abi folder> <version ig: kovan/0.6.0>
const path = resolve(process.argv[2])
const gebVersion = process.argv[3] || 'kovan/1.3.0'

function resolve(...args) {
    args = args.slice()
    args.unshift('..')
    args.unshift(__dirname)
    return _resolve.apply(null, args)
}

async function main() {
    let files = fs.readdirSync(path)
    let prettierConfig = await prettier.resolveConfig('.prettierrc.json')

    files = files.filter((x) => x.endsWith('.json'))
    for (let f of files) {
        const url = `https://raw.githubusercontent.com/reflexer-labs/geb-changelog/master/releases/${gebVersion}/median/fixed-discount/abi/${f.slice(
            0,
            -5
        )}.abi`

        let abi
        try {
            abi = (await axios.get(url)).data
        } catch (err) {
            if (err.response.status === 404) {
                console.log(`- ABI ${f} not found at url ${url}`)
                continue
            } else {
                throw Error('Error fetching ABIs')
            }
        }

        // Stringify and format abi
        abi = JSON.stringify(abi)
        abi = prettier.format(abi, { ...prettierConfig, parser: 'json' })

        fs.writeFileSync(path + '/' + f, abi)
    }
}

main()
