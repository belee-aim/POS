# Copyright (c) 2025, AIM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class StorepayAPISettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		app_password: DF.Data | None
		app_username: DF.Data | None
		password: DF.Data | None
		username: DF.Data | None
	# end: auto-generated types
	pass
