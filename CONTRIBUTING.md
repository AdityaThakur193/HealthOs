# Contributing

Health OS is **no longer actively developed** in this repository, so pull requests and feature requests are not being accepted.

You are welcome to fork it. The code is licensed under the [GNU AGPLv3](LICENSE), so a fork, or a version you host for other people, must:

- keep the original credits to **Aditya Thakur**, and
- publish its source code under AGPLv3.

## Running it in your fork

Setup steps are in the [README](README.md#getting-started). Before you push changes, run the same checks as CI:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

## Security issues

Please don't open a public issue for a security problem. See [SECURITY.md](SECURITY.md).
