package com.bryan.donas.data.db

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "business_configs", indices = [Index("createdAt")])
data class BusinessConfigEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val boxCostCents: Long,
    val donutsPerBox: Int,
    val donutPriceCents: Long,
    val createdAt: Long
)

@Entity(tableName = "accounts", indices = [Index(value = ["code"], unique = true)])
data class AccountEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val code: String, val name: String)

@Entity(tableName = "partners")
data class PartnerEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val name: String, val createdAt: Long)

@Entity(tableName = "share_plans", indices = [Index("createdAt"), Index(value = ["requestKey"], unique = true)])
data class ProfitSharePlanEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mode: String,
    val partialMode: String,
    val createdAt: Long,
    val requestKey: String
)

@Entity(tableName = "share_members", primaryKeys = ["planId", "partnerId"],
    foreignKeys = [
        ForeignKey(entity = ProfitSharePlanEntity::class, parentColumns = ["id"], childColumns = ["planId"], onDelete = ForeignKey.RESTRICT),
        ForeignKey(entity = PartnerEntity::class, parentColumns = ["id"], childColumns = ["partnerId"], onDelete = ForeignKey.RESTRICT)
    ], indices = [Index("partnerId")])
data class ProfitShareMemberEntity(
    val planId: Long, val partnerId: Long, val nameSnapshot: String,
    val basisPoints: Int, val fixedCents: Long, val remainder: Boolean, val position: Int
)

@Entity(tableName = "app_state", foreignKeys = [
    ForeignKey(entity = BusinessConfigEntity::class, parentColumns = ["id"], childColumns = ["configId"], onDelete = ForeignKey.RESTRICT),
    ForeignKey(entity = ProfitSharePlanEntity::class, parentColumns = ["id"], childColumns = ["planId"], onDelete = ForeignKey.RESTRICT)
], indices = [Index("configId"), Index("planId")])
data class AppStateEntity(@PrimaryKey val id: Long = 1, val configId: Long, val planId: Long)

@Entity(tableName = "expense_categories", indices = [Index(value = ["name"], unique = true)])
data class ExpenseCategoryEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val name: String)
