import React from 'react'
import { ViewProps, ViewStyle, ScrollViewProps } from 'react-native'

export type IDndRowData<T> = T & {
	id: string
}

export type IDndData<T> = T & {
	id: string
	rows: IDndRowData<T>[]
}

export class Repository<T> {
	constructor(data: IDndData<T>[])
	updateData: (data: T) => void
	addColumn: (data: T) => void
	updateColumn: (columnId: string, data: T) => void
	deleteColumn: (columnId: string) => void
	addRow: (columnId: string, data: T) => void
	updateRow: (rowId: string, data: T) => void
	deleteRow: (rowId: string) => void
	getItemsChanged: () => { rows: IDndRowData<T> }
}

export interface IDndRenderColumnWrapper<T> {
	item: IDndData<T>
	index: number
	columnComponent: JSX.Element
	layoutProps: ViewProps
}

interface Props<T> {
	repository: Repository<T>
	renderRow: ({
		item,
		index,
	}: {
		item: IDndRowData<T>
		index: number
	}) => JSX.Element
	renderColumnWrapper: ({
		item,
		index,
		columnComponent,
		layoutProps,
	}: IDndRenderColumnWrapper<T>) => JSX.Element
	onRowPress?: (row: IDndRowData<T>) => void
	onDragStart?: () => void
	onDragEnd?: (
		fromColumnId: string,
		toColumnId: string,
		row: IDndRowData<T>
	) => void
	style?: ViewStyle
	columnWidth?: number
	accessoryRight?: (() => JSX.Element) | JSX.Element
	activeRowStyle?: ViewStyle
	activeRowRotation?: number
	xScrollThreshold?: number
	yScrollThreshold?: number
	dragSpeedFactor?: number,
	rootScrollProps?: ScrollViewProps
}

declare const DraggableBoard: <T>(props: Props<T>) => JSX.Element
export default DraggableBoard
