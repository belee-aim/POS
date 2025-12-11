# Copyright (c) 2025, AIM and Contributors
# License: GNU General Public License v3. See license.txt

import frappe
from frappe import _
from frappe.utils import cint, flt
from frappe.utils.nestedset import get_root_of


@frappe.whitelist()
def get_warehouses():
	"""Get list of warehouses for selection"""
	warehouses = frappe.get_all(
		"Warehouse",
		filters={"is_group": 0, "disabled": 0},
		fields=["name", "warehouse_name", "parent_warehouse"],
		order_by="warehouse_name",
	)
	return warehouses


@frappe.whitelist()
def get_pos_profile_warehouse(pos_profile):
	"""Get warehouse from POS Profile"""
	if not pos_profile:
		return None
	warehouse = frappe.db.get_value("POS Profile", pos_profile, "warehouse")
	return warehouse


@frappe.whitelist()
def get_pos_profile_data(pos_profile):
	"""Get warehouse and company from POS Profile"""
	if not pos_profile:
		return None
	data = frappe.db.get_value("POS Profile", pos_profile, ["warehouse", "company"], as_dict=True)
	return data


@frappe.whitelist()
def get_items(start=0, page_length=40, item_group=None, search_term="", from_warehouse=None, to_warehouse=None):
	"""Get items with stock information for both warehouses"""
	result = []

	if not item_group:
		item_group = get_root_of("Item Group")

	if not frappe.db.exists("Item Group", item_group):
		item_group = get_root_of("Item Group")

	lft, rgt = frappe.db.get_value("Item Group", item_group, ["lft", "rgt"])

	condition = get_conditions(search_term)

	items_data = frappe.db.sql(
		"""
		SELECT
			item.name AS item_code,
			item.item_name,
			item.description,
			item.stock_uom,
			item.image AS item_image,
			item.is_stock_item
		FROM
			`tabItem` item
		WHERE
			item.disabled = 0
			AND item.has_variants = 0
			AND item.is_stock_item = 1
			AND item.is_fixed_asset = 0
			AND item.item_group in (SELECT name FROM `tabItem Group` WHERE lft >= {lft} AND rgt <= {rgt})
			AND {condition}
		ORDER BY
			item.name asc
		LIMIT
			{page_length} offset {start}""".format(
			start=cint(start),
			page_length=cint(page_length),
			lft=cint(lft),
			rgt=cint(rgt),
			condition=condition,
		),
		as_dict=1,
	)

	if not items_data:
		return {"items": result}

	for item in items_data:
		item.uom = item.stock_uom

		# Get stock qty for from_warehouse
		item.from_warehouse_qty = 0
		if from_warehouse:
			item.from_warehouse_qty = get_stock_qty(item.item_code, from_warehouse)

		# Get stock qty for to_warehouse
		item.to_warehouse_qty = 0
		if to_warehouse:
			item.to_warehouse_qty = get_stock_qty(item.item_code, to_warehouse)

		result.append(item)

	return {"items": result}


@frappe.whitelist()
def search_by_term(search_term, from_warehouse=None, to_warehouse=None):
	"""Search item by barcode, serial no or item code"""
	from erpnext.stock.utils import scan_barcode

	result = scan_barcode(search_term) or {}

	item_code = result.get("item_code", search_term)
	serial_no = result.get("serial_no", "")
	batch_no = result.get("batch_no", "")
	barcode = result.get("barcode", "")

	if not result:
		return None

	if not frappe.db.exists("Item", item_code):
		return None

	item_doc = frappe.get_doc("Item", item_code)

	if not item_doc.is_stock_item:
		return None

	item = {
		"barcode": barcode,
		"batch_no": batch_no,
		"description": item_doc.description,
		"is_stock_item": item_doc.is_stock_item,
		"item_code": item_doc.name,
		"item_group": item_doc.item_group,
		"item_image": item_doc.image,
		"item_name": item_doc.item_name,
		"serial_no": serial_no,
		"stock_uom": item_doc.stock_uom,
		"uom": item_doc.stock_uom,
		"from_warehouse_qty": get_stock_qty(item_code, from_warehouse) if from_warehouse else 0,
		"to_warehouse_qty": get_stock_qty(item_code, to_warehouse) if to_warehouse else 0,
	}

	return {"items": [item]}


def get_stock_qty(item_code, warehouse):
	"""Get actual stock quantity for item in warehouse"""
	if not warehouse:
		return 0

	qty = frappe.db.get_value(
		"Bin",
		{"item_code": item_code, "warehouse": warehouse},
		"actual_qty",
	)
	return flt(qty)


def get_conditions(search_term):
	"""Build search conditions"""
	condition = "("
	condition += """item.name like {search_term}
		or item.item_name like {search_term}""".format(search_term=frappe.db.escape("%" + search_term + "%"))
	condition += ")"

	return condition


@frappe.whitelist()
def get_parent_item_group():
	"""Get root item group"""
	item_group = frappe.get_all("Item Group", {"lft": 1, "is_group": 1}, pluck="name")
	if item_group:
		return item_group[0]
	return None


@frappe.whitelist()
def item_group_query(doctype, txt, searchfield, start, page_len, filters):
	"""Query for item group autocomplete"""
	return frappe.db.sql(
		f""" select distinct name from `tabItem Group`
			where (name like %(txt)s) limit {page_len} offset {start}""",
		{"txt": "%%%s%%" % txt},
	)


@frappe.whitelist()
def create_material_request(items, from_warehouse, to_warehouse, schedule_date=None, remarks=None, purpose="Material Transfer"):
	"""Create Material Request document"""
	if isinstance(items, str):
		import json
		items = json.loads(items)

	if not items:
		frappe.throw(_("Please add items to create Material Request"))

	if not from_warehouse:
		frappe.throw(_("Please select source warehouse"))

	if not to_warehouse:
		frappe.throw(_("Please select target warehouse"))

	if from_warehouse == to_warehouse:
		frappe.throw(_("Source and target warehouse cannot be the same"))

	# Use provided schedule_date or default to today
	if not schedule_date:
		schedule_date = frappe.utils.today()

	# Create Material Request
	mr = frappe.new_doc("Material Request")
	mr.material_request_type = purpose
	mr.set_warehouse = to_warehouse
	mr.schedule_date = schedule_date

	# Add remarks if provided
	if remarks:
		mr.custom_remarks = remarks

	for item in items:
		if flt(item.get("qty", 0)) <= 0:
			continue

		mr.append("items", {
			"item_code": item.get("item_code"),
			"qty": flt(item.get("qty")),
			"uom": item.get("uom") or item.get("stock_uom"),
			"stock_uom": item.get("stock_uom"),
			"warehouse": to_warehouse,
			"from_warehouse": from_warehouse,
			"schedule_date": schedule_date,
		})

	if not mr.items:
		frappe.throw(_("No valid items to create Material Request"))

	mr.insert()
	mr.submit()

	return {
		"name": mr.name,
		"doctype": mr.doctype,
	}


@frappe.whitelist()
def get_stock_availability(item_code, warehouse):
	"""Get stock availability for an item in a warehouse"""
	qty = get_stock_qty(item_code, warehouse)
	return qty
