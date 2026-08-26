// @types/react bundled with this project predates the `inert` DOM attribute.
// Augment HTMLAttributes so `inert` can be used on any element in JSX
// (React 18 forwards unknown boolean DOM attributes as-is).
import 'react'

declare module 'react' {
  interface HTMLAttributes<T> {
    // React 18 tratta inert come attributo custom non-boolean: si passa '' per
    // attivarlo (true genera il warning "non-boolean attribute").
    inert?: boolean | ''
  }
}
