# Contributing to Chrxmaticc AI

## How to Contribute

### Report Bugs (or on commands)
Open an issue on GitHub with:
- What you were doing
- What you expected to happen
- What actually happened
- Your Node.js version
- Any error output

### Suggest Features
Open an issue tagged `enhancement`. Describe what you want and why it's useful for us for Chrxmaticc AI.

### Submit Code
1. Fork the repo
2. Create a branch (`feature/my-feature` or `fix/my-fix`)
3. Write your code
4. Make sure existing tests pass (`npm test`)
5. Open a pull request

## Code Style

- Use 4 spaces for indentation
- Semicolons required
- Single quotes for strings
- Either use discord.js or ChrxCommandBuilder

## To install Chrxmaticc Framework if doing ChrxCommandBuilder
```bash
npm install chrxmaticc-framework
```
```js
// Balance check
new ChrxCommandBuilder({
  name: "balance", cooldown: 5,
  async run(interaction, { economy }) {
    interaction.reply(`💰 **${data.balance}** coins`);
  }
});
```

## Adding New Features

If you're adding a new structure or manager:
- Add the class in the correct folder
- Dont add duplicate stuff, like commands.
- Add documentation in the README API reference section

## Testing

```bash
npm test
```

Currently no test suite exists. Genuinely thank you if you write another one.

## Review Process

Pull requests are reviewed within a week. You might be asked to:
- Add comments
- Add type definitions
- Explain your changes

## Code of Conduct

Don't be toxic. This is an average no life discord bot made by a goated vibe coder (me), not an really important one like greed. but i do it for funsies and my members
