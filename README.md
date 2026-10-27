# dev-env-1-mycelium

The development environment for the first development phase of SPLectrum:
the self-contained repository's rules on git, with XPath access. It builds
three packages, as folders on `main`:

- `mycelium-uri` — our URIs: parse, validate, split at known prefixes
- `mycelium-xpath` — navigate a tree by path, generic
- `mycelium-git` — all the repository rules over a backend contract

Each package is published later to its own product repository.

Status: seed — prepared in `splectrum/roadmap-1`, 2026-10-27
