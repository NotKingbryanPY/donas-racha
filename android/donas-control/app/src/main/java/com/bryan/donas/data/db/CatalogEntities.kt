package com.bryan.donas.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "flavor_cache")
data class FlavorEntity(@PrimaryKey val id: String, val sku: String, val name: String,
    val available: Boolean, val active: Boolean, val updatedAt: String)

@Entity(tableName = "catalog_outbox")
data class CatalogOperationEntity(@PrimaryKey val operationId: String, val variantId: String,
    val name: String, val available: Boolean, val expectedUpdatedAt: String,
    val state: String = "PENDING", val lastError: String? = null)
