// @types/react bundled with this project predates the `inert` DOM attribute.
// Augment HTMLAttributes so `inert` can be used on any element in JSX
// (React 18 forwards unknown boolean DOM attributes as-is).
import 'react'

declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: boolean
  }
}
