module.exports = {
    ...require('@graphprotocol/graph-ts/.prettierrc.json'),
  
    printWidth: 100,
  
    overrides: [
      {
        files: '*.json',
        options: {
          printWidth: 80,
        },
      },
    ],
  }