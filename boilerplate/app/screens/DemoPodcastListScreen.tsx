import { observer } from "mobx-react-lite"
import React, { useEffect } from "react"
import {
  TouchableOpacity,
  FlatList,
  Image,
  ImageStyle,
  TextStyle,
  View,
  ViewStyle,
  StyleSheet,
  Platform,
} from "react-native"
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { Icon, Screen, Switch, Text } from "../components"
import { translate } from "../i18n"
import { useStores } from "../models"
import { Episode } from "../models/Episode"
import { DemoTabScreenProps } from "../navigators/DemoNavigator"
import { colors, spacing } from "../theme"
import { delay } from "../utils/delay"
import { openLinkInBrowser } from "../utils/open-link-in-browser"

const ICON_SIZE = 24

export const DemoPodcastListScreen = observer(function DemoPodcastListScreen(
  _props: DemoTabScreenProps<"DemoPodcastList">,
) {
  const { episodeStore } = useStores()

  const [refreshing, setRefreshing] = React.useState(false)

  // initially, kick off a background refresh without the refreshing UI
  useEffect(() => {
    episodeStore.fetchEpisodes()
  }, [episodeStore])

  // simulate a longer refresh, if the refresh is too fast for UX
  async function manualRefresh() {
    setRefreshing(true)
    await Promise.all([episodeStore.fetchEpisodes(), delay(750)])
    setRefreshing(false)
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]}>
      <FlatList<Episode>
        data={episodeStore.episodesForList}
        extraData={episodeStore.favorites.length + episodeStore.episodes.length}
        contentContainerStyle={$flatListContentContainer}
        refreshing={refreshing}
        onRefresh={manualRefresh}
        ListHeaderComponent={
          <View style={$heading}>
            <Text preset="heading" tx="demoPodcastListScreen.title" />
            <View style={[$rowLayout, $toggle]}>
              <Switch
                accessibilityLabel={translate("demoPodcastListScreen.accessibility.switch")}
                value={episodeStore.favoritesOnly}
                onToggle={() => episodeStore.setProp("favoritesOnly", !episodeStore.favoritesOnly)}
              />
              <Text style={$toggleText} tx="demoPodcastListScreen.onlyFavorites" />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <EpisodeCard
            episode={item}
            isFavorite={episodeStore.hasFavorite(item)}
            onPressFavorite={() => episodeStore.toggleFavorite(item)}
          />
        )}
      />
    </Screen>
  )
})

const EpisodeCard = observer(function EpisodeCard({
  episode,
  isFavorite,
  onPressFavorite,
}: {
  episode: Episode
  onPressFavorite: () => void
  isFavorite: boolean
}) {
  const liked = useSharedValue(isFavorite ? 1 : 0)

  // Grey heart
  const animatedLikeButtonStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(liked.value, [0, 1], [1, 0], Extrapolate.EXTEND),
        },
      ],
      opacity: interpolate(liked.value, [0, 1], [1, 0], Extrapolate.CLAMP),
    }
  })

  // Pink heart
  const animatedUnlikeButtonStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: liked.value,
        },
      ],
      opacity: liked.value,
    }
  })

  const handlePressFavorite = () => {
    onPressFavorite()
    liked.value = withSpring(liked.value ? 0 : 1)
  }
  return (
    <TouchableOpacity
      style={[$rowLayout, $item]}
      onPress={() => openLinkInBrowser(episode.enclosure.link)}
      onLongPress={handlePressFavorite}
      accessibilityHint={translate("demoPodcastListScreen.accessibility.cardHint", {
        action: isFavorite ? "unfavorite" : "favorite",
      })}
      accessibilityActions={
        Platform.OS === "android"
          ? [
              {
                name: "longpress",
                label: "Toggle Favorite",
              },
            ]
          : []
      }
    >
      <View style={$description}>
        <Text>{episode.title}</Text>
        <View style={[$rowLayout, $metadata]}>
          <View accessibilityLabel={isFavorite ? "favorited" : "not favorited"}>
            <Animated.View
              style={[$iconContainer, StyleSheet.absoluteFillObject, animatedLikeButtonStyles]}
            >
              <Icon icon="heart" size={ICON_SIZE} onPress={handlePressFavorite} />
            </Animated.View>
            <Animated.View style={[$iconContainer, animatedUnlikeButtonStyles]}>
              <Icon
                icon="heart"
                size={ICON_SIZE}
                color={colors.palette.primary400}
                onPress={handlePressFavorite}
              />
            </Animated.View>
          </View>
          <Text size="xs">{episode.datePublished}</Text>
          <Text size="xs" accessibilityLabel={episode.duration.accessibilityLabel}>
            {episode.duration.textLabel}
          </Text>
        </View>
      </View>
      <Image source={{ uri: episode.thumbnail }} style={$itemThumbnail} />
    </TouchableOpacity>
  )
})

// #region Styles
const THUMBNAIL_DIMENSION = 100

const $flatListContentContainer: ViewStyle = {
  paddingHorizontal: spacing.large,
  paddingTop: spacing.large,
}

const $heading: ViewStyle = {
  marginBottom: spacing.medium,
}

const $description: TextStyle = {
  flex: 1,
  justifyContent: "space-between",
}

const $item: ViewStyle = {
  backgroundColor: colors.palette.neutral100,
  borderRadius: 8,
  padding: spacing.medium,
  marginTop: spacing.medium,
}

const $rowLayout: ViewStyle = {
  flexDirection: "row",
}

const $toggle: ViewStyle = {
  alignItems: "center",
  marginTop: spacing.small,
}

const $toggleText: TextStyle = {
  marginStart: spacing.extraSmall,
}

const $iconContainer: ViewStyle = {
  height: ICON_SIZE,
  width: ICON_SIZE,
}

const $itemThumbnail: ImageStyle = {
  width: THUMBNAIL_DIMENSION,
  height: THUMBNAIL_DIMENSION,
  marginStart: spacing.extraSmall,
}

const $metadata: TextStyle = {
  justifyContent: "space-between",
  color: colors.textDim,
  marginTop: spacing.extraSmall,
}
// #endregion
