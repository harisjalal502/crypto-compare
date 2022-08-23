import { Instance, SnapshotIn, SnapshotOut, types } from "mobx-state-tree"
import { withSetPropAction } from "./helpers/with-set-prop-action"
import { format } from "date-fns"

interface Enclosure {
  link: string
  type: string
  length: number
  duration: number
  rating: { scheme: string; value: string }
}

/**
 * This represents an episode of React Native Radio.
 */
export const EpisodeModel = types
  .model("Episode")
  .props({
    guid: types.identifier,
    title: "",
    pubDate: "",
    link: "",
    author: "",
    thumbnail: "",
    description: "",
    content: "",
    enclosure: types.frozen<Enclosure>(),
    categories: types.array(types.string),
  })
  .actions(withSetPropAction)
  .views((episode) => ({
    get datePublished() {
      const date = new Date(episode.pubDate)
      return format(date, "MMM dd, yyyy")
    },
    get duration() {
      const seconds = Number(episode.enclosure.duration)
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = Math.floor((seconds % 3600) % 60)

      const hDisplay = h > 0 ? `${h}:` : ""
      const mDisplay = m > 0 ? `${m}:` : ""
      const sDisplay = s > 0 ? s : ""
      return hDisplay + mDisplay + sDisplay
    },
  }))

export interface Episode extends Instance<typeof EpisodeModel> {}
export interface EpisodeSnapshotOut extends SnapshotOut<typeof EpisodeModel> {}
export interface EpisodeSnapshotIn extends SnapshotIn<typeof EpisodeModel> {}
