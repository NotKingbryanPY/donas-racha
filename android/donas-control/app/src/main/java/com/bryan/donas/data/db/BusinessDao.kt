package com.bryan.donas.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface BusinessDao {
    @Query("SELECT * FROM app_state WHERE id = 1") fun observeState(): Flow<AppStateEntity?>
    @Query("SELECT * FROM app_state WHERE id = 1") suspend fun state(): AppStateEntity?
    @Insert suspend fun insertState(state: AppStateEntity)
    @Update suspend fun updateState(state: AppStateEntity)
    @Insert suspend fun insertConfig(config: BusinessConfigEntity): Long
    @Query("SELECT * FROM business_configs WHERE id = :id") suspend fun config(id: Long): BusinessConfigEntity
    @Query("SELECT * FROM business_configs ORDER BY id DESC LIMIT :limit OFFSET :offset") suspend fun configs(limit: Int, offset: Int): List<BusinessConfigEntity>
    @Insert suspend fun insertAccount(account: AccountEntity): Long
    @Query("SELECT * FROM accounts ORDER BY id") suspend fun accounts(): List<AccountEntity>
    @Query("SELECT * FROM accounts WHERE code=:code LIMIT 1") suspend fun account(code: String): AccountEntity?
    @Insert suspend fun insertPartner(partner: PartnerEntity): Long
    @Query("SELECT * FROM partners ORDER BY id") suspend fun partners(): List<PartnerEntity>
    @Insert suspend fun insertPlan(plan: ProfitSharePlanEntity): Long
    @Query("SELECT * FROM share_plans WHERE id = :id") suspend fun plan(id: Long): ProfitSharePlanEntity
    @Query("SELECT * FROM share_plans WHERE requestKey = :key") suspend fun planByKey(key: String): ProfitSharePlanEntity?
    @Query("SELECT * FROM share_plans ORDER BY id DESC LIMIT :limit OFFSET :offset") suspend fun plans(limit: Int, offset: Int): List<ProfitSharePlanEntity>
    @Insert suspend fun insertMembers(members: List<ProfitShareMemberEntity>)
    @Query("SELECT * FROM share_members WHERE planId = :id ORDER BY position") suspend fun members(id: Long): List<ProfitShareMemberEntity>
    @Insert suspend fun insertCategories(categories: List<ExpenseCategoryEntity>)
    @Query("SELECT * FROM expense_categories ORDER BY id") suspend fun categories(): List<ExpenseCategoryEntity>
    @Query("SELECT * FROM expense_categories WHERE name=:name LIMIT 1") suspend fun category(name: String): ExpenseCategoryEntity?
}
