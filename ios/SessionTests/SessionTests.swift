import XCTest
import Foundation
import DonasControlCore
@testable import DonasControlSession

private final class TestWire: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int,Data))!
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (status,data)=try Self.handler(request)
            client?.urlProtocol(self,didReceive:HTTPURLResponse(url:request.url!,statusCode:status,httpVersion:"HTTP/1.1",headerFields:["Content-Type":"application/json"])!,cacheStoragePolicy:.notAllowed)
            client?.urlProtocol(self,didLoad:data);client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self,didFailWithError:error) }
    }
    override func stopLoading() {}
}
private final class Saved: @unchecked Sendable {
    let lock=NSLock()
    var token: String?="old-refresh"
    var refreshes=0
    var status=200
    var failSave=false
    var rejectFirst=false
    var writesBeforeRequest=true
    func persist(_ session: AdminSession?) throws {
        lock.lock();defer { lock.unlock() }
        if failSave { throw BusinessError.invalid("Storage unavailable") }
        token=session?.refreshToken
    }
    func response(_ request: URLRequest) throws -> (Int,Data) {
        lock.lock();defer { lock.unlock() }
        var http=200
        let payload: [String:Any]
        if request.url!.path=="/api/auth/session" {
            refreshes+=1;http=status
            payload=["accessToken":"renewed","refreshToken":"rotated","expiresAt":"2099-01-01T00:00:00.000Z","userId":"owner","role":"ADMIN"]
        } else {
            if request.value(forHTTPHeaderField:"Authorization")=="Bearer renewed" { writesBeforeRequest = writesBeforeRequest && token=="rotated" }
            if rejectFirst && request.value(forHTTPHeaderField:"Authorization")=="Bearer first" { http=401 }
            payload=[:]
        }
        let response: [String:Any]=http==200 ? ["ok":true,"data":payload] : ["ok":false,"error":["code":http==401 ? "INVALID_CREDENTIALS" : "AUTH_UNAVAILABLE","message":"Test failure"]]
        return (http,try JSONSerialization.data(withJSONObject:response))
    }
}
final class SessionTests: XCTestCase {
    private func make(_ saved: Saved,expired: Bool=true) -> SessionClient {
        TestWire.handler=saved.response
        let configuration=URLSessionConfiguration.ephemeral;configuration.protocolClasses=[TestWire.self]
        return SessionClient(base:URL(string:"https://example.test")!,transport:URLSession(configuration:configuration),
            initial:AdminSession(accessToken:"first",refreshToken:"old-refresh",expiresAt:expired ? "2000-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z",userId:"owner",role:"ADMIN"),persist:saved.persist)
    }
    func testTransientOutagesRetainSession() async throws {
        let saved=Saved(),client=make(saved)
        for status in [429,502,503] {
            saved.status=status
            do { let _: JSONValue=try await client.request("/read");XCTFail("Expected failure") } catch {}
            let signedIn=await client.signedIn;XCTAssertTrue(signedIn);XCTAssertEqual(saved.token,"old-refresh")
        }
        saved.status=200;let _: JSONValue=try await client.request("/read");XCTAssertEqual(saved.token,"rotated")
    }
    func testConcurrentRenewalPersistsBeforeAnyRequest() async throws {
        let saved=Saved(),client=make(saved)
        try await withThrowingTaskGroup(of:Void.self) { group in
            for _ in 0..<12 { group.addTask { let _: JSONValue=try await client.request("/read") } }
            try await group.waitForAll()
        }
        XCTAssertEqual(saved.refreshes,1);XCTAssertEqual(saved.token,"rotated");XCTAssertTrue(saved.writesBeforeRequest)
    }
    func testRejectedAccessRetriesWithoutPassword() async throws {
        let saved=Saved();saved.rejectFirst=true;let client=make(saved,expired:false)
        let _: JSONValue=try await client.request("/read")
        XCTAssertEqual(saved.refreshes,1);XCTAssertEqual(saved.token,"rotated")
    }
    func testRevocationClearsSession() async throws {
        let saved=Saved();saved.status=401;let client=make(saved)
        do { let _: JSONValue=try await client.request("/read");XCTFail("Expected revocation") } catch {}
        let signedIn=await client.signedIn;XCTAssertFalse(signedIn);XCTAssertNil(saved.token)
    }
    func testFailedPersistenceDoesNotPublishRenewedAccess() async throws {
        let saved=Saved();saved.failSave=true;let client=make(saved)
        do { let _: JSONValue=try await client.request("/read");XCTFail("Expected storage failure") } catch {}
        XCTAssertEqual(saved.token,"old-refresh")
    }
}
