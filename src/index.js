import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Gesture,
	GestureDetector,
	ScrollView,
} from 'react-native-gesture-handler'
import Animated, {
	runOnJS,
	scrollTo,
	useAnimatedReaction,
	useAnimatedRef,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
} from 'react-native-reanimated'

import style from './style'
import Column from './components/column'
import Repository from './handlers/repository'
import Utils from './commons/utils'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

const SCROLL_THRESHOLD = 50
const SCROLL_STEP = 8

const DraggableBoard = ({
	repository,
	renderColumnWrapper,
	renderRow,
	columnWidth,
	accessoryRight,
	activeRowStyle,
	activeRowRotation = 8,
	xScrollThreshold = SCROLL_THRESHOLD,
	yScrollThreshold = SCROLL_THRESHOLD,
	dragSpeedFactor = 1,
	onRowPress = () => {},
	onDragStart = () => {},
	onDragEnd = () => {},
	style: boardStyle,
	horizontal = true,
	rootScrollView,
	flatListRowProps
}) => {
	const [, setForceUpdate] = useState(false)
	const [hoverComponent, setHoverComponent] = useState(null)
	const [movingMode, setMovingMode] = useState(false)

	const translateX = useSharedValue(0)
	const translateY = useSharedValue(0)

	const pageIndex = useSharedValue(0)
	const columnsLength = useSharedValue(repository.getColumns().length)
	const containerWidth = useSharedValue(0)
	const gapSpace = useSharedValue(0)
	const autoScrollX = useSharedValue(0)
	const [mounted, setMounted] = useState(false)

	const scrollViewRef = useAnimatedRef()
	const scrollX = useSharedValue(0)
	const hoverRowItem = useRef()

	useEffect(() => {
		repository.setReload(() => setForceUpdate(prevState => !prevState))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	/**------------------------------------------------------------
	 * Moving Item handler
	 * ------------------------------------------------------------*/
	const listenRowChangeColumn = (fromColumnId, toColumnId) => {
		if (hoverRowItem.current) {
			if (hoverRowItem.current?.columnId)
				hoverRowItem.current.columnId = toColumnId
			if (hoverRowItem.current?.oldColumnId)
				hoverRowItem.current.oldColumnId = fromColumnId
		}
	}

	const keyExtractor = useCallback(
		(item, index) => `${item.id}${item.name}${index}`,
		[]
	)

	const animatedStyles = useAnimatedStyle(() => ({
		transform: [
			{ translateX: translateX.value },
			{ translateY: translateY.value },
			{ rotate: `${activeRowRotation}deg` },
		],
	}))

	const renderHoverComponent = () => {
		if (hoverComponent && hoverRowItem.current) {
			const row = repository.findRow(hoverRowItem.current)

			if (row && row.layout) {
				const { x, y, width, height } = row.layout
				const hoverStyle = [
					style.hoverComponent,
					activeRowStyle,
					animatedStyles,
					{
						top: y - yScrollThreshold,
						left: x,
						width,
						height,
					},
				]

				return (
					<Animated.View style={hoverStyle}>{hoverComponent}</Animated.View>
				)
			}
		}
	}

	const moveItem = async (hoverItem, rowItem, isColumn = false) => {
		rowItem.setHidden(true)
		repository.hideRow(rowItem)
		await rowItem.measureLayout()
		hoverRowItem.current = { ...rowItem }

		setMovingMode(true)
		setHoverComponent(hoverItem)
	}

	const drag = column => {
		const hoverColumn = renderColumnWrapper({
			move: moveItem,
			item: column.data,
			index: column.index,
		})
		moveItem(hoverColumn, column, true)
	}

	const onEndDrag = () => {
		if (
			onDragEnd &&
			hoverRowItem.current &&
			hoverRowItem.current.oldColumnId &&
			hoverRowItem.current.columnId
		) {
			onDragEnd(
				hoverRowItem.current?.oldColumnId,
				hoverRowItem.current?.columnId,
				hoverRowItem.current
			)
			repository.updateOriginalData()
		}
		if (hoverRowItem.current) repository.showRow(hoverRowItem.current)
		hoverRowItem.current = null
		setHoverComponent(null)
		setMovingMode(false)
	}

	// handle scroll when drag to left or right
	const getOffsetByIndex = useCallback(
		index => {
			'worklet'
			const width = containerWidth.value + gapSpace.value
			const side = (Utils.deviceWidth - width) / 2
			return (
				index * width -
				(index == 0 ? 0 : index < columnsLength.value ? 1 : 2) * side
			)
		},
		[columnsLength, containerWidth, gapSpace]
	)

	// calculate page index when dragging item
	useAnimatedReaction(
		() => autoScrollX.value,
		autoScrollX => {
			if (movingMode) {
				if (autoScrollX == 1 && pageIndex.value < columnsLength.value - 1) {
					pageIndex.value = pageIndex.value + 1
				} else if (autoScrollX == -1 && pageIndex.value > 0) {
					pageIndex.value = pageIndex.value - 1
				}
			}
		}
	)

	// scroll to page index if it change
	useAnimatedReaction(
		() => pageIndex.value,
		page => {
			if (movingMode) {
				scrollTo(scrollViewRef, getOffsetByIndex(page), 0, true)
			}
		}
	)

	const handleRowPosition = ([x, y]) => {
		if (hoverRowItem.current && (x || y)) {
			const columnAtPosition = repository.moveRow(
				hoverRowItem.current,
				x,
				y,
				listenRowChangeColumn
			)

			if (columnAtPosition) {
				if (x + xScrollThreshold > Utils.deviceWidth) {
					autoScrollX.value = 1
				} else if (x < xScrollThreshold) {
					autoScrollX.value = -1
				} else {
					autoScrollX.value = 0
				}
				repository.measureColumnsLayout()

				// handle scroll inside item
				// if (y + SCROLL_THRESHOLD > columnAtPosition.layout.y) {
				//   repository.columns[columnAtPosition.id].scrollX(y + SCROLL_STEP);
				// } else if (y < SCROLL_THRESHOLD) {
				//   repository.columns[columnAtPosition.id].scrollX(y - SCROLL_STEP);
				// }
			}
		}
	}

	const handleColumnPosition = ([x, y]) => {
		//
	}

	// delay resetLayout
	const resetLayout = useCallback(() => {
		setTimeout(() => {
			translateX.value = 0
			translateY.value = 0
		}, 100)
	}, [])

	/**-------------------------------------------------------------------
	 * Columns
	 * -------------------------------------------------------------------*/
	const renderColumns = () => {
		const columns = repository.getColumns()
		return columns.map((column, index) => {
			const key = keyExtractor(column, index)

			const columnComponent = (
				<Column
					repository={repository}
					column={column}
					move={moveItem}
					renderColumnWrapper={renderColumnWrapper}
					keyExtractor={keyExtractor}
					renderRow={renderRow}
					scrollEnabled={!movingMode}
					columnWidth={columnWidth}
					onRowPress={onRowPress}
					onDragStartCallback={onDragStart}
					{...flatListRowProps}
				/>
			)

			return renderColumnWrapper({
				item: column.data,
				index: column.index,
				columnComponent,
				drag: () => drag(column),
				layoutProps: {
					key,
					ref: ref => repository.updateColumnRef(column.id, ref),
					onLayout: layout => {
						const _layout = layout.nativeEvent.layout
						// get container width of columns
						// (you can pass it from outside component)
						containerWidth.value = _layout.width
						repository.updateColumnLayout(column.id)
						// get gap space
						if (gapSpace.value > 0) {
							gapSpace.value = Math.min(gapSpace.value, _layout.x)
						} else {
							gapSpace.value = _layout.x
						}
						// rerender once again when got layout
						!mounted && setMounted(true)
					},
				},
			})
		})
	}

	/** ---------------------------------------------------------------
	 * Scroll
	 * --------------------------------------------------------------*/
	const getIndexByOffset = useCallback(
		offsetX => {
			'worklet'
			const width = containerWidth.value + gapSpace.value
			const side = (Utils.deviceWidth - width) / 2
			return offsetX <= width - side ||
				offsetX >= (columnsLength.value - 1) * width - side
				? Math.round(offsetX / (width - side))
				: Math.round(offsetX / width)
		},
		[containerWidth.value, xScrollThreshold, columnsLength, gapSpace]
	)

	// set offsets array into scroll view
	// to make paging effect
	const offSetArray = useMemo(
		() => repository.getColumns().map((_, index) => getOffsetByIndex(index)),
		[repository.getColumns()]
	)

	const onScrollEnd = useCallback(event => {
		repository.measureColumnsLayout()
	}, [])

	// recalculate page index when scroll
	const onScroll = useAnimatedScrollHandler(event => {
		if (!movingMode) {
			pageIndex.value = getIndexByOffset(event.contentOffset.x)
		}
		scrollX.value = event.contentOffset.x
	})

	/**--------------------------------------------------------
	 * Gesture
	 * -------------------------------------------------------*/
	const onGesture = Gesture.Pan()
		.onUpdate(event => {
			translateX.value = event.translationX
			translateY.value = event.translationY
			runOnJS(handleRowPosition)([event.absoluteX, event.absoluteY])
		})
		.onEnd(event => {
			if (movingMode) {
				runOnJS(resetLayout)()
			}
		})
		.onTouchesUp(() => {
			runOnJS(onEndDrag)()
			autoScrollX.value = 0
		})

	return (
		<GestureDetector gesture={onGesture}>
			<Animated.View style={[style.container, boardStyle]}>
				<AnimatedScrollView
					ref={scrollViewRef}
					scrollEnabled={!movingMode}
					horizontal={horizontal}
					decelerationRate={'fast'}
					snapToOffsets={offSetArray}
					nestedScrollEnabled
					showsHorizontalScrollIndicator={false}
					showsVerticalScrollIndicator={false}
					scrollEventThrottle={16}
					onScroll={onScroll}
					onMomentumScrollEnd={onScrollEnd}
					onScrollEndDrag={onScrollEnd}
					{...rootScrollView}
				>
					{renderColumns()}
					{Utils.isFunction(accessoryRight) ? accessoryRight() : accessoryRight}
				</AnimatedScrollView>
				{renderHoverComponent()}
			</Animated.View>
		</GestureDetector>
	)
}

export default DraggableBoard
export { Repository }
