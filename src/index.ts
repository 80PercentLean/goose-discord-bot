import * as handlers from './handlers'
import { factory } from './init'

export default factory.discord().loader(Object.values(handlers))
